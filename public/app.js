const VALERIO_KEYS = ["V", "A", "L", "E", "R", "I", "O"];
const VALERIO_LABELS = {
  V: "Vigore",
  A: "Astuzia",
  L: "Lucidita",
  E: "Ego",
  R: "Rigore",
  I: "Istinto",
  O: "Opportunismo"
};

const appState = {
  cardsById: new Map(),
  socket: null,
  connected: false,
  selfId: null,
  snapshot: null,
  lastError: "",
  playerName: localStorage.getItem("vtg:name") || "",
  selectedCardId: "",
  draftPreviewCardId: "",
  menuOpen: false,
  plan: {
    cardId: "",
    attacks: {},
    defenses: {},
    useActive: false
  },
  handOrder: [],
  draggedCardId: "",
  justDraggedUntil: 0,
  chatVisible: false,
  chatFocusRequested: false,
  chatLastMessageId: "",
  chatHideTimer: null,
  chatPosition: readChatPosition()
};

class GameApp extends HTMLElement {
  connectedCallback() {
    this.onKeyDown = (event) => {
      const lobby = appState.snapshot?.lobby;
      const key = event.key.toLowerCase();

      if (event.key === "Escape" && isChatTarget(event.target)) {
        event.preventDefault();
        event.target.blur?.();
        scheduleChatHide(() => this.render(), 10000);
        return;
      }

      if (key === "t" && lobby && !isTypingTarget(event.target)) {
        event.preventDefault();
        appState.chatVisible = true;
        appState.chatFocusRequested = true;
        clearChatHideTimer();
        this.render();
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (!lobby) {
        return;
      }

      event.preventDefault();
      appState.menuOpen = !appState.menuOpen;
      this.render();
    };
    document.addEventListener("keydown", this.onKeyDown);
    this.clock = window.setInterval(() => this.updateTimers(), 250);
    this.loadCards();
    this.connect();
    this.render();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.documentElement.classList.remove("has-menu-open");
    document.body.classList.remove("has-menu-open");
    window.clearInterval(this.clock);
  }

  async loadCards() {
    const response = await fetch("/data/cards.json");
    const data = await response.json();
    const cards = readCards(data);
    appState.cardsById = new Map(cards.map((card) => [card.id, card]));
    this.render();
  }

  connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}`);
    appState.socket = socket;

    socket.addEventListener("open", () => {
      appState.connected = true;
      this.render();
      if (appState.playerName) {
        send("setName", { name: appState.playerName });
      }
      const lobbyFromUrl = new URLSearchParams(location.search).get("lobby");
      if (lobbyFromUrl) {
        send("joinLobby", { lobbyId: lobbyFromUrl });
      }
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "hello") {
        appState.selfId = message.selfId;
      }
      if (message.type === "state") {
        const previousChatId = appState.chatLastMessageId || getLastChatMessageId(appState.snapshot?.lobby);
        appState.snapshot = message;
        appState.selfId = message.selfId;
        this.keepSelectionValid();
        this.syncChatVisibility(message.lobby, previousChatId, message.selfId);
      }
      if (message.type === "error") {
        appState.lastError = message.message;
        window.setTimeout(() => {
          if (appState.lastError === message.message) {
            appState.lastError = "";
            this.render();
          }
        }, 3000);
      }
      this.render();
    });

    socket.addEventListener("close", () => {
      appState.connected = false;
      this.render();
      window.setTimeout(() => this.connect(), 1200);
    });
  }

  keepSelectionValid() {
    const lobby = appState.snapshot?.lobby;
    const hand = lobby?.self?.deck ?? [];

    if (!lobby) {
      appState.selectedCardId = "";
      appState.draftPreviewCardId = "";
      resetPlan();
      return;
    }

    if (lobby.phase === "draft") {
      const pool = lobby.draft?.pool ?? [];
      const firstVisible = pool.find((item) => item.canPick)?.card?.id ?? pool.find((item) => item.isAvailable)?.card?.id ?? pool[0]?.card?.id ?? "";
      const previewItem = pool.find((item) => item.card?.id === appState.draftPreviewCardId);
      if (!previewItem || !previewItem.isAvailable) {
        appState.draftPreviewCardId = firstVisible;
      }
      appState.selectedCardId = "";
      resetPlan();
      return;
    }

    if (lobby.phase === "select") {
      syncHandOrder(hand);
      const available = hand.find((card) => !isCardCooling(lobby.self, card.id));
      const selectedValid = hand.some((card) => card.id === appState.selectedCardId && !isCardCooling(lobby.self, card.id));
      if (!selectedValid) {
        appState.selectedCardId = available?.id ?? "";
      }
      resetPlan();
      return;
    }

    if (lobby.phase === "plan") {
      const selectedCardId = lobby.self?.selected?.cardId ?? "";
      const card = getCardById(selectedCardId);
      if (selectedCardId) {
        appState.selectedCardId = selectedCardId;
      }
      if (card && appState.plan.cardId !== selectedCardId) {
        appState.plan = makeDefaultPlan(card, lobby.self);
      }
      if (card && appState.plan.useActive && !canUseActive(card, lobby.self)) {
        appState.plan.useActive = false;
      }
      return;
    }

    resetPlan();
  }

  render() {
    const snapshot = appState.snapshot;
    const lobby = snapshot?.lobby;
    const focusState = this.captureFocusState();
    const title = lobby ? (lobby.phase === "lobby" ? "Lobby" : phaseLabel(lobby.phase)) : "Lobby";
    const hideMatchChrome = Boolean(lobby && !["lobby", "draft"].includes(lobby.phase));
    const menuOpen = Boolean(lobby && appState.menuOpen);
    document.documentElement.classList.toggle("has-menu-open", menuOpen);
    document.body.classList.toggle("has-menu-open", menuOpen);

    this.innerHTML = `
      <main class="shell ${hideMatchChrome ? "is-match-focus" : ""}">
        ${
          hideMatchChrome
            ? ""
            : `
              <section class="topbar ${lobby ? "is-compact" : ""}">
                <div>
                  <p class="eyebrow">valeverce</p>
                  <h1>${escapeHtml(title)}</h1>
                </div>
                ${lobby ? `<div class="lobby-code"><span>Codice</span><strong>${escapeHtml(lobby.id)}</strong></div>` : ""}
                <div class="connection ${appState.connected ? "is-online" : ""}">
                  ${appState.connected ? "Online" : "Connessione"}
                </div>
              </section>
            `
        }
        ${appState.lastError ? `<p class="toast">${escapeHtml(appState.lastError)}</p>` : ""}
        ${lobby ? this.renderLobby(lobby, snapshot, hideMatchChrome) : this.renderHome(snapshot)}
        ${lobby && appState.menuOpen ? this.renderEscMenu(lobby, snapshot) : ""}
      </main>
    `;

    this.bindEvents();
    this.openMenuDialog();
    this.restoreFocusState(focusState);
    this.focusChatIfRequested();
    this.scrollChatToBottom();
    this.updateTimers();
  }

  captureFocusState() {
    const active = document.activeElement;
    if (!this.contains(active)) {
      return null;
    }

    if (active?.dataset?.action === "name-input") {
      return captureInputFocus(active, { kind: "name" });
    }

    if (active?.closest?.('[data-action="chat"]')) {
      return captureInputFocus(active, { kind: "chat" });
    }

    if (active?.dataset?.action === "plan-slider") {
      return captureInputFocus(active, {
        kind: "plan-slider",
        planKind: active.dataset.planKind,
        planStat: active.dataset.planStat
      });
    }

    return null;
  }

  restoreFocusState(focusState) {
    if (!focusState) {
      return;
    }

    let input = null;
    if (focusState.kind === "name") {
      input = this.querySelector('[data-action="name-input"]');
    }
    if (focusState.kind === "chat") {
      input = this.querySelector('[data-action="chat"] input');
    }
    if (focusState.kind === "plan-slider") {
      input = this.querySelector(
        `[data-action="plan-slider"][data-plan-kind="${focusState.planKind}"][data-plan-stat="${focusState.planStat}"]`
      );
    }

    if (!input) {
      return;
    }

    input.value = focusState.value;
    input.focus();
    if (typeof focusState.start === "number" && typeof focusState.end === "number" && input.type !== "range") {
      input.setSelectionRange(focusState.start, focusState.end);
    }
  }

  scrollChatToBottom() {
    const chatLog = this.querySelector(".chat-log");
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  focusChatIfRequested() {
    if (!appState.chatFocusRequested) {
      return;
    }

    const input = this.querySelector('[data-action="chat"] input');
    if (input) {
      input.focus();
    }
    appState.chatFocusRequested = false;
  }

  syncChatVisibility(lobby, previousChatId, selfId) {
    const latestChatId = getLastChatMessageId(lobby);
    if (!latestChatId) {
      appState.chatLastMessageId = "";
      return;
    }

    if (!previousChatId) {
      appState.chatLastMessageId = latestChatId;
      return;
    }

    if (latestChatId === previousChatId) {
      appState.chatLastMessageId = latestChatId;
      return;
    }

    const chat = lobby?.chat ?? [];
    const previousIndex = chat.findIndex((message) => message.id === previousChatId);
    const newMessages = previousIndex >= 0 ? chat.slice(previousIndex + 1) : chat.slice(-1);
    appState.chatLastMessageId = latestChatId;

    if (newMessages.some((message) => message.kind === "user" && message.playerId && message.playerId !== selfId)) {
      appState.chatVisible = true;
      appState.chatFocusRequested = false;
      scheduleChatHide(() => this.render());
    }
  }

  updateTimers() {
    this.querySelectorAll(".timer-pill").forEach((timer) => {
      const deadlineAt = Number(timer.dataset.deadlineAt ?? 0);
      const seconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      const label = timer.querySelector("strong");
      if (label) {
        label.textContent = `${seconds}s`;
      }
      timer.classList.toggle("is-low", seconds <= 5);
    });
  }

  syncPlanUi() {
    const lobby = appState.snapshot?.lobby;
    const card = getCardById(lobby?.self?.selected?.cardId);
    if (!lobby || lobby.phase !== "plan" || !card) {
      return;
    }

    this.querySelectorAll(".choice-panel[data-plan-kind]").forEach((panel) => {
      syncPlanPanel(panel, card);
    });

    const validation = getPlanValidation(lobby, card);
    const submitted = Boolean(lobby.self?.selected?.attacks && lobby.self?.selected?.defenses);
    const submitButton = this.querySelector('.action-dock [data-action="submit-plan"]');
    if (submitButton) {
      submitButton.disabled = Boolean(!lobby.self?.isActive || submitted || !validation.ok);
    }

    const dockState = this.querySelector(".dock-state small");
    if (dockState) {
      dockState.textContent = submitted ? "Piano confermato." : validation.ok ? "Pronto a confermare." : validation.error;
    }

    const manaPreview = getManaPreview(lobby, lobby.self, card, lobby.settings ?? {});
    const manaBar = this.querySelector(".action-dock .resource-bar.is-mana");
    if (manaBar) {
      manaBar.dataset.tooltip = `Mana ${manaPreview}/${lobby.settings?.maxMana ?? 10}`;
      manaBar.querySelector("i").style.width = `${percent(manaPreview, lobby.settings?.maxMana ?? 10)}%`;
      manaBar.querySelector("span").textContent = `Mana ${manaPreview}/${lobby.settings?.maxMana ?? 10}`;
    }

    const stats = this.querySelector(".dock-card-stats");
    if (stats) {
      stats.outerHTML = renderDockStats(card, appState.plan);
    }

    const trait = this.querySelector(".dock-trait");
    if (trait) {
      trait.outerHTML = renderDockTrait(card, appState.plan);
    }

    const opponent = getActivePlayers(lobby).find((player) => player.id !== appState.selfId);
    this.querySelectorAll("[data-plan-preview-lines], [data-main-preview-lines]").forEach((preview) => {
      const lines = getPlanPreviewLines(card, opponent?.selectedCard, appState.plan.attacks);
      preview.innerHTML = lines.length
        ? lines
        .map((line) => renderPreviewLine(line))
        .join("")
        : renderEmptyPreview();
    });
  }

  renderHome(snapshot) {
    const lobbies = snapshot?.lobbies ?? [];
    return `
      <section class="panel home-grid">
        <div class="join-panel">
          <label>
            Nome
            <input data-action="name-input" maxlength="18" value="${escapeAttr(appState.playerName)}" placeholder="Player" />
          </label>
        </div>
        <div class="join-panel">
          <button type="button" data-action="create">Crea lobby</button>
          <form class="inline-form" data-action="join">
            <input name="lobbyId" maxlength="6" placeholder="Codice lobby" />
            <button type="submit">Entra</button>
          </form>
        </div>
      </section>
      <section class="panel">
        <div class="section-title">
          <h2>Lobby aperte</h2>
          <span>${lobbies.length}</span>
        </div>
        <div class="lobby-list">
          ${
            lobbies.length
              ? lobbies.map((lobby) => this.renderLobbyRow(lobby)).join("")
              : `<p class="empty">Nessuna lobby aperta.</p>`
          }
        </div>
      </section>
    `;
  }

  renderEscMenu(lobby, snapshot) {
    const isHost = lobby.hostId === snapshot.selfId;
    return `
      <dialog class="menu-modal" data-menu-dialog aria-label="Menu">
        <div>
          <p class="eyebrow">Menu</p>
          <h2>valeverce</h2>
        </div>
        <div class="menu-actions">
          <button type="button" data-action="close-menu">Riprendi</button>
          ${isHost ? `<button type="button" class="ghost" data-action="restart">Reset lobby</button>` : ""}
          <button type="button" class="ghost" data-action="leave">Esci lobby</button>
        </div>
      </dialog>
    `;
  }

  openMenuDialog() {
    const dialog = this.querySelector("[data-menu-dialog]");
    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
  }

  renderLobbyRow(lobby) {
    const canJoin = lobby.phase === "lobby" && lobby.players < lobby.maxPlayers;
    return `
      <article class="lobby-row">
        <div>
          <strong>${escapeHtml(lobby.id)}</strong>
          <span>${lobby.players}/${lobby.maxPlayers} player</span>
          <small>${escapeHtml(lobby.names.join(", "))}</small>
        </div>
        <button type="button" data-action="join-code" data-lobby-id="${escapeAttr(lobby.id)}" ${canJoin ? "" : "disabled"}>
          Entra
        </button>
      </article>
    `;
  }

  renderLobby(lobby, snapshot, hideMatchChrome = false) {
    const isHost = lobby.hostId === snapshot.selfId;
    return `
      ${
        hideMatchChrome
          ? ""
          : `
            <section class="panel match-head">
              <div>
                <p class="eyebrow">${escapeHtml(phaseLabel(lobby.phase))}</p>
                <h2>${lobby.players.length}/${snapshot.settings.maxPlayers} player</h2>
              </div>
              <div class="actions">
                <button type="button" class="ghost" data-action="leave">Esci</button>
              </div>
            </section>
          `
      }
      <section class="layout">
        <aside class="panel left-rail">
          ${this.renderPlayerBoard(lobby, snapshot)}
        </aside>
        <section class="panel table">
          ${this.renderPhase(lobby, snapshot)}
        </section>
        <aside class="panel right-rail">
          ${this.renderSidePanel(lobby, snapshot)}
        </aside>
      </section>
      ${this.renderActionDock(lobby, snapshot, isHost)}
      ${this.renderChat(lobby)}
    `;
  }

  renderPlayerBoard(lobby, snapshot) {
    const activeOpponents = new Set((lobby.activePair ?? []).filter((playerId) => playerId !== snapshot.selfId));
    return `
      <div class="player-board">
        <div class="terminal-title">
          <span>player</span>
          <strong>${lobby.players.length}</strong>
        </div>
        <div class="top-players">
          ${
            lobby.players
              .map((player) => renderTopPlayer(player, lobby.phase, snapshot.settings, activeOpponents.has(player.id), player.id === snapshot.selfId))
              .join("") || `<p class="empty compact">Nessun player.</p>`
          }
        </div>
      </div>
    `;
  }

  renderChat(lobby) {
    const position = appState.chatPosition;
    const style = position ? `style="left: ${Number(position.x)}px; top: ${Number(position.y)}px;"` : "";
    return `
      <div class="chat-float ${appState.chatVisible ? "is-visible" : "is-hidden"}" data-chat-window ${style}>
        <div class="chat-head" data-chat-drag>
          <span>chat</span>
          <strong>${lobby.chat?.length ?? 0}</strong>
          <button type="button" class="chat-close" data-action="hide-chat" aria-label="Nascondi chat">x</button>
        </div>
        <div class="chat-log">
          ${(lobby.chat ?? []).map((message) => renderChatMessage(message)).join("")}
        </div>
        <form class="chat-form" data-action="chat">
          <input name="text" maxlength="240" placeholder="Scrivi..." />
          <button type="submit">Invia</button>
        </form>
      </div>
    `;
  }

  renderActionDock(lobby, snapshot, isHost) {
    const self = lobby.self;
    const action = getDockAction(lobby, snapshot, isHost);
    const dockCard = getDockCard(lobby);
    const manaPreview = getManaPreview(lobby, self, dockCard, snapshot.settings);
    const activeCost = Number(dockCard?.active?.cost ?? 0);
    const canToggleActive = Boolean(lobby.phase === "plan" && self?.isActive && dockCard && canUseActive(dockCard, self));
    const submittedPlan = Boolean(lobby.phase === "plan" && self?.selected?.attacks && self?.selected?.defenses);
    return `
      <section class="action-hud ${dockCard ? "has-card" : ""}" data-action-dock>
        <div class="dock-topline">
          ${dockCard ? renderDockTrait(dockCard, appState.plan, lobby.phase === "plan") : `<div class="dock-trait is-empty"></div>`}
          <div class="dock-state">
            <span>${escapeHtml(action.state)}</span>
            <small>${escapeHtml(action.detail)}</small>
          </div>
        </div>
        <div class="hud-main">
          ${renderDockCard(dockCard)}
          <div class="action-dock">
            ${dockCard ? renderDockStats(dockCard, appState.plan) : `<div class="dock-card-stats is-empty"></div>`}
            <div class="dock-actions">
              ${
                lobby.phase === "plan" && dockCard
                  ? `
                    <button
                      type="button"
                      class="dock-active rich-tooltip ${appState.plan.useActive ? "is-on" : ""}"
                      data-action="toggle-active-button"
                      ${canToggleActive && !submittedPlan ? "" : "disabled"}
                      data-tooltip=""
                    >
                      Attiva <small>-${activeCost}</small>
                      ${renderTooltipContent(dockCard.active?.text ?? "")}
                    </button>
                  `
                  : ""
              }
              <button type="button" data-action="${escapeAttr(action.action)}" data-card-id="${escapeAttr(action.cardId ?? "")}" ${action.enabled ? "" : "disabled"}>
                ${escapeHtml(action.label)}
              </button>
            </div>
            <div class="dock-bars">
              ${renderMiniResource("PV", self?.health ?? 0, self?.maxHealth ?? snapshot.settings.maxHealth, "health")}
              ${renderMiniResource("Mana", manaPreview, snapshot.settings.maxMana, "mana")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderSidePanel(lobby, snapshot) {
    const self = lobby.self;
    const activePlayers = getActivePlayers(lobby);
    const opponent = activePlayers.find((player) => player.id !== snapshot.selfId);
    const selectedCard =
      lobby.phase === "select" ? getCardById(appState.selectedCardId) : getCardById(self?.selected?.cardId);
    const opponentCard = opponent?.selectedCard;

    if (lobby.phase === "draft") {
      const previewCard = getDraftPreviewCard(lobby);
      return `
        <div class="side-summary card-inspector">
          <p class="eyebrow">Inspector</p>
          ${previewCard ? renderInspectorCard(previewCard, "Carta draft") : `<p class="empty">Seleziona una carta.</p>`}
          <div class="summary-line"><span>Turno</span><strong>${escapeHtml(getPlayerName(lobby, lobby.draft?.currentPlayerId) ?? "Player")}</strong></div>
          <div class="summary-line"><span>Budget</span><strong>${self?.draftSpent ?? 0}/${self?.draftBudget ?? 20}</strong></div>
          <div class="summary-line"><span>Rimanente</span><strong>${self?.draftBudgetRemaining ?? 0}</strong></div>
        </div>
      `;
    }

    if (lobby.phase === "select") {
      return `
        <div class="side-summary">
          <p class="eyebrow">Scelta carta</p>
          <h2>${self?.isActive ? "La tua coperta" : "Spettatore"}</h2>
          <div class="summary-line"><span>PV</span><strong>${self?.health ?? 0}/${self?.maxHealth ?? 50}</strong></div>
          <div class="summary-line"><span>Mana</span><strong>${self?.mana ?? 0}</strong></div>
          ${selectedCard ? renderCardMath(selectedCard, "Preview carta") : `<p class="empty">Seleziona una carta disponibile.</p>`}
        </div>
      `;
    }

    if (lobby.phase === "plan") {
      return renderPlanSummary(lobby, self, selectedCard, opponent, opponentCard);
    }

    if (lobby.phase === "reveal" || lobby.phase === "ended") {
      return renderResultSummary(lobby.lastResult, snapshot.selfId);
    }

    return `
      <div class="side-summary">
        <p class="eyebrow">Lobby</p>
        <h2>${lobby.players.length}/${snapshot.settings.maxPlayers}</h2>
        <p>In attesa dell'inizio.</p>
      </div>
    `;
  }

  renderPhase(lobby, snapshot) {
    if (lobby.phase === "lobby") {
      return `
        <div class="waiting">
          <h2>In attesa</h2>
          <p>${lobby.players.length < snapshot.settings.minPlayers ? `Servono ${snapshot.settings.minPlayers} player.` : "Pronti."}</p>
        </div>
      `;
    }

    if (lobby.phase === "draft") {
      return this.renderDraft(lobby);
    }

    if (lobby.phase === "select") {
      return this.renderSelect(lobby);
    }

    if (lobby.phase === "plan") {
      return this.renderPlan(lobby, snapshot);
    }

    if (lobby.phase === "reveal") {
      return this.renderResult(lobby, false);
    }

    return this.renderResult(lobby, true);
  }

  renderDraft(lobby) {
    const self = lobby.self;
    const currentName = getPlayerName(lobby, lobby.draft?.currentPlayerId) ?? "Player";
    const isMyTurn = self?.isCurrentDrafter;

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Draft</p>
          <h2>${isMyTurn ? "Scegli una carta" : `Tocca a ${escapeHtml(currentName)}`}</h2>
        </div>
        <div class="turn-tools">
          ${renderTimer(lobby)}
          <div class="draft-counter">${self?.deck.length ?? 0}/${lobby.draft?.target ?? 6}</div>
        </div>
      </div>
      <div class="mana-line">
        <span>Budget ${self?.draftSpent ?? 0}/${self?.draftBudget ?? 20}</span>
        <span>Rimanente ${self?.draftBudgetRemaining ?? 0}</span>
        <span class="muted">Clicca una carta per leggerla a destra, poi drafta.</span>
      </div>
      <div class="draft-picked">
        <strong>Le tue carte draftate</strong>
        <div>${(self?.deck ?? []).map((card) => `<span>${escapeHtml(card.name)}</span>`).join("") || "<span>Nessuna</span>"}</div>
      </div>
      <div class="draft-pool">
        ${(lobby.draft?.pool ?? []).map((item) => renderDraftCard(item, item.card?.id === appState.draftPreviewCardId)).join("")}
      </div>
    `;
  }

  renderSelect(lobby) {
    const self = lobby.self;
    const orderedDeck = orderCards(self.deck);
    const selectedCard = orderedDeck.find((card) => card.id === appState.selectedCardId) ?? orderedDeck.find((card) => !isCardCooling(self, card.id));
    const alreadyPlayed = Boolean(self.selected?.cardId);
    const activePlayers = getActivePlayers(lobby);
    const pairLabel = activePlayers.map((player) => player.name).join(" vs ");
    const selectableCount = orderedDeck.filter((card) => !isCardCooling(self, card.id)).length;

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Duello ${lobby.round}</p>
          <h2>${escapeHtml(pairLabel)}</h2>
        </div>
        <div class="turn-tools">
          ${renderTimer(lobby)}
          <div class="draft-counter">${self.health} PV</div>
          <div class="draft-counter">${self.mana} M</div>
        </div>
      </div>
      ${
        self.alive && self.isActive
          ? `
            <div class="mana-line">
              <span>${selectableCount} carte disponibili</span>
              <span>${Object.keys(self.cooldowns ?? {}).length} in cooldown</span>
              <span class="muted">${alreadyPlayed ? "Carta coperta scelta" : "Scegli una carta coperta"}</span>
            </div>
            <div class="hand-section">
              <div class="section-title">
                <h2>Le tue carte</h2>
                <span>${self.deck.length}</span>
              </div>
              <div class="hand ${appState.draggedCardId ? "is-sorting" : ""}">
                ${orderedDeck
                  .map((card) =>
                    renderCardElement({
                      card,
                      selected: card.id === selectedCard?.id,
                      disabled: alreadyPlayed || isCardCooling(self, card.id),
                      draggable: !alreadyPlayed,
                      cooldown: Number(self.cooldowns?.[card.id] ?? 0)
                    })
                  )
                  .join("")}
              </div>
            </div>
          `
          : `<div class="waiting"><h2>Stai guardando</h2><p>${escapeHtml(pairLabel)} stanno scegliendo la carta.</p></div>`
      }
    `;
  }

  renderPlan(lobby, snapshot) {
    const self = lobby.self;
    const activePlayers = getActivePlayers(lobby);
    const selfPlayer = activePlayers.find((player) => player.id === snapshot.selfId);
    const opponents = activePlayers.filter((player) => player.id !== snapshot.selfId);
    const isParticipant = Boolean(selfPlayer);
    const pairLabel = activePlayers.map((player) => player.name).join(" vs ");
    const card = getCardById(self?.selected?.cardId);
    const opponent = opponents[0];
    const opponentCard = opponent?.selectedCard;

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Fight ${lobby.round}</p>
          <h2>${escapeHtml(pairLabel)}</h2>
        </div>
        <div class="turn-tools">
          <div class="draft-counter">${self?.health ?? 0} PV</div>
          <div class="draft-counter">${self?.mana ?? 0} M</div>
        </div>
      </div>
      ${isParticipant && self?.isActive && card ? renderFightPreviewOverview(card, opponentCard) : ""}
      ${
        isParticipant && self?.isActive && card
          ? selfPlayer.hasSubmittedPlan
            ? `<p class="notice">Piano confermato. In attesa dell'avversario.</p>`
            : this.renderPlanControls(lobby, card, opponent, opponentCard, selfPlayer, snapshot.selfId)
          : `<div class="waiting"><h2>Lobby duello</h2><p>I player attivi stanno distribuendo attacchi e difese.</p></div>`
      }
    `;
  }

  renderPlanControls(lobby, card, opponent, opponentCard, selfPlayer, selfId) {
    const validation = getPlanValidation(lobby, card);
    const attackPool = getAttackPool(card);
    const defensePool = getDefensePool(card);

    return `
      <section class="plan-controls">
        <div class="duel-planner is-grid">
          <section class="duel-zone own-zone defense-zone">
            <div class="duel-zone-head">
              <div class="fight-lane-title">
                <span class="role-pill is-you">TU</span>
                <div>
                  <strong>${escapeHtml(selfPlayer.name)}</strong>
                  <small>proteggi la tua carta</small>
                </div>
              </div>
              ${renderStats(card, [], Object.keys(appState.plan.defenses))}
            </div>
            ${renderPlanDistribution({
              title: "",
              kind: "defenses",
              card,
              opponentCard,
              distribution: appState.plan.defenses,
              pool: defensePool,
              slots: lobby.settings?.defenseSlots ?? 3
            })}
          </section>
          <section class="duel-zone enemy-zone attack-zone">
            <div class="duel-zone-head">
              <div class="fight-lane-title">
                <span class="role-pill is-opponent">TARGET</span>
                <div>
                  <strong>${escapeHtml(opponent?.name ?? "Avversario")}</strong>
                  <small>${opponentCard ? escapeHtml(opponentCard.name) : "carta avversaria rivelata"}</small>
                </div>
              </div>
              ${opponentCard ? renderStats(opponentCard, Object.keys(appState.plan.attacks), [], getOpponentStatInfluences(card, appState.plan)) : ""}
            </div>
            ${renderPlanDistribution({
              title: "",
              kind: "attacks",
              card,
              opponentCard,
              distribution: appState.plan.attacks,
              pool: attackPool,
              slots: lobby.settings?.attackSlots ?? 3
            })}
          </section>
        </div>
        ${validation.ok ? "" : `<p class="notice">${escapeHtml(validation.error)}</p>`}
      </section>
    `;
  }

  renderResult(lobby, ended) {
    const result = lobby.lastResult;
    const winner = lobby.players.find((player) => player.id === lobby.winnerId);
    const duelWinner = result?.winnerId ? result.plays.find((play) => play.playerId === result.winnerId) : null;

    if (!result) {
      return `
        <div class="waiting">
          <h2>${ended ? "Fine partita" : "Risultato"}</h2>
          <p>${winner ? `${escapeHtml(winner.name)} vince.` : "Nessun risultato."}</p>
        </div>
      `;
    }

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">${ended ? "Fine partita" : `Turno ${result.round}`}</p>
          <h2>${duelWinner ? `${escapeHtml(duelWinner.playerName)} vince` : "Pareggio"}</h2>
        </div>
        <div class="turn-tools">
          <div class="draft-counter">${result.summary?.damage ?? 0} PV</div>
        </div>
      </div>
      <div class="fight-flow is-reveal">
        <div><strong>${result.plays[0]?.breach ?? 0}</strong><span>${escapeHtml(result.plays[0]?.playerName ?? "P1")} Breccia</span></div>
        <div><strong>${result.plays[1]?.breach ?? 0}</strong><span>${escapeHtml(result.plays[1]?.playerName ?? "P2")} Breccia</span></div>
        <div><strong>${result.summary?.damage ?? 0}</strong><span>Danno PV applicato</span></div>
      </div>
      ${result.isTie ? `<p class="notice">Pareggio: nessuno perde PV, entrambe le carte vanno in cooldown.</p>` : ""}
      <div class="result-list">
        ${result.plays.map((play) => renderResultRow(play)).join("")}
      </div>
      ${
        ended && winner
          ? `<div class="winner-banner">${escapeHtml(winner.name)} vince la partita con ${winner.health} PV.</div>`
          : ""
      }
    `;
  }

  bindEvents() {
    this.querySelectorAll("[data-card-image]").forEach((image) => {
      image.addEventListener("error", () => {
        image.hidden = true;
      });
    });

    this.querySelector('[data-action="name-input"]')?.addEventListener("input", (event) => {
      appState.playerName = String(event.currentTarget.value || "");
      localStorage.setItem("vtg:name", appState.playerName);
      send("setName", { name: appState.playerName.trim() });
    });

    this.querySelector('[data-action="join"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const lobbyId = new FormData(event.currentTarget).get("lobbyId");
      send("joinLobby", { lobbyId });
    });

    this.querySelector('[data-action="chat"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector("input");
      if (!input.value.trim()) {
        return;
      }
      send("sendChat", { text: input.value });
      input.value = "";
    });

    this.querySelector("[data-chat-window]")?.addEventListener("focusin", () => {
      appState.chatVisible = true;
      clearChatHideTimer();
    });

    this.querySelector("[data-chat-window]")?.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!this.querySelector("[data-chat-window]")?.contains(document.activeElement)) {
          scheduleChatHide(() => this.render(), 10000);
        }
      }, 0);
    });

    this.bindChatDrag();

    this.querySelector("[data-menu-dialog]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        appState.menuOpen = false;
        this.render();
      }
    });

    this.querySelector("[data-menu-dialog]")?.addEventListener("cancel", (event) => {
      event.preventDefault();
      appState.menuOpen = false;
      this.render();
    });

    this.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", () => {
        const action = element.dataset.action;
        if (action === "create") send("createLobby");
        if (action === "join-code") send("joinLobby", { lobbyId: element.dataset.lobbyId });
        if (action === "leave") {
          appState.menuOpen = false;
          send("leaveLobby");
        }
        if (action === "close-menu") {
          appState.menuOpen = false;
          this.render();
        }
        if (action === "hide-chat") {
          appState.chatVisible = false;
          clearChatHideTimer();
          this.render();
        }
        if (action === "start") send("startGame");
        if (action === "next-round") send("nextRound");
        if (action === "restart") {
          appState.menuOpen = false;
          send("restartLobby");
        }
        if (action === "draft-card" && !element.hasAttribute("disabled")) {
          send("draftCard", { cardId: element.dataset.cardId });
        }
        if (action === "preview-draft-card") {
          appState.draftPreviewCardId = element.dataset.cardId;
          this.render();
        }
        if (action === "draft-selected-card" && !element.hasAttribute("disabled")) {
          send("draftCard", { cardId: element.dataset.cardId });
        }
        if (action === "toggle-active-button" && !element.hasAttribute("disabled")) {
          appState.plan.useActive = !appState.plan.useActive;
          this.render();
        }
        if (action === "select-card" && !element.hasAttribute("disabled")) {
          if (Date.now() < appState.justDraggedUntil) {
            return;
          }
          appState.selectedCardId = element.dataset.cardId;
          this.render();
        }
        if (action === "submit-card") {
          send("selectCard", { cardId: appState.selectedCardId });
        }
        if (action === "submit-plan") {
          send("submitPlan", {
            attacks: appState.plan.attacks,
            defenses: appState.plan.defenses,
            useActive: appState.plan.useActive
          });
        }
      });
    });

    this.querySelectorAll('[data-action="plan-slider"]').forEach((input) => {
      input.addEventListener("input", (event) => {
        updatePlanPoints(input.dataset.planKind, input.dataset.planStat, event.currentTarget.value);
        this.syncPlanUi();
      });
      input.addEventListener("change", (event) => {
        updatePlanPoints(input.dataset.planKind, input.dataset.planStat, event.currentTarget.value);
        this.render();
      });
    });

    this.querySelectorAll("[data-draggable-card]").forEach((element) => {
      element.addEventListener("dragstart", (event) => {
        appState.draggedCardId = element.dataset.cardId;
        appState.justDraggedUntil = Date.now() + 500;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", element.dataset.cardId);
        element.classList.add("is-dragging");
      });

      element.addEventListener("dragend", () => {
        appState.draggedCardId = "";
        appState.justDraggedUntil = Date.now() + 500;
        this.render();
      });

      element.addEventListener("dragover", (event) => {
        event.preventDefault();
        const moved = moveHandCard(appState.draggedCardId, element.dataset.cardId);
        if (moved) {
          this.render();
        }
      });

      element.addEventListener("drop", (event) => {
        event.preventDefault();
        const draggedCardId = event.dataTransfer.getData("text/plain") || appState.draggedCardId;
        moveHandCard(draggedCardId, element.dataset.cardId);
        appState.draggedCardId = "";
        appState.justDraggedUntil = Date.now() + 500;
        this.render();
      });
    });
  }

  bindChatDrag() {
    const chat = this.querySelector("[data-chat-window]");
    const handle = this.querySelector("[data-chat-drag]");
    if (!chat || !handle) {
      return;
    }

    let dragState = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) {
        return;
      }

      const rect = chat.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      chat.classList.add("is-dragging");
      handle.setPointerCapture?.(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState) {
        return;
      }

      const rect = chat.getBoundingClientRect();
      const x = clamp(event.clientX - dragState.offsetX, 8, window.innerWidth - rect.width - 8);
      const y = clamp(event.clientY - dragState.offsetY, 8, window.innerHeight - rect.height - 8);
      chat.style.left = `${x}px`;
      chat.style.top = `${y}px`;
      chat.style.right = "auto";
      chat.style.bottom = "auto";
      appState.chatPosition = { x, y };
    });

    const finishDrag = (event) => {
      if (!dragState) {
        return;
      }

      dragState = null;
      chat.classList.remove("is-dragging");
      handle.releasePointerCapture?.(event.pointerId);
      writeChatPosition(appState.chatPosition);
    };

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  }
}

class GameCard extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ["data-card-id", "data-action-name", "data-selected", "data-disabled", "data-cooldown"];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const card = getCardById(this.dataset.cardId);
    if (!card) {
      return;
    }

    const initials = getInitials(card.name);
    const cooldown = Number(this.dataset.cooldown ?? 0);

    this.innerHTML = `
      <button type="button" data-action="${escapeAttr(this.dataset.actionName || "select-card")}" data-card-id="${escapeAttr(card.id)}" ${this.dataset.disabled === "true" ? "disabled" : ""}>
        <div class="card-image-fallback">
          <span>${escapeHtml(initials)}</span>
        </div>
        <img class="card-full-image" data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
        <div class="card-body card-overlay">
          <strong>${escapeHtml(card.name)}</strong>
          <small>${escapeHtml(card.id)}</small>
          ${renderStats(card)}
          ${renderCombat(card)}
          <div class="abilities">
            <div class="ability-list">
              <span class="ability-name">${escapeHtml(card.active?.name ?? "Attiva")}</span>
              <span class="ability-text">${renderAbilityText(card.active?.text ?? "")}</span>
            </div>
            <div class="ability-list">
              <span class="ability-name">${escapeHtml(card.passive?.name ?? "Tratto")}</span>
              <span class="ability-text">${renderAbilityText(card.passive?.text ?? "")}</span>
            </div>
          </div>
        </div>
        ${cooldown > 0 ? `<span class="cooldown-badge">${cooldown}</span>` : ""}
      </button>
    `;

    const image = this.querySelector("img");
    image?.addEventListener("error", () => {
      image.hidden = true;
    });
  }
}

customElements.define("game-app", GameApp);
customElements.define("game-card", GameCard);

function renderTopPlayer(player, phase, settings, isCurrentOpponent = false, isSelf = false) {
  const status = getPlayerStatus(player, phase);
  const cards = player.deck ?? [];
  const maxHealth = Number(player.maxHealth ?? settings?.maxHealth ?? 50);
  const maxMana = Number(settings?.maxMana ?? 10);
  const healthPct = percent(player.health, maxHealth);
  const manaPct = percent(player.mana, maxMana);
  return `
    <article class="top-player ${player.alive ? "" : "is-out"} ${isCurrentOpponent ? "is-current-opponent" : ""} ${isSelf ? "is-self" : ""}">
      <div class="top-player-head">
        <strong>${escapeHtml(player.name)}</strong>
        <small>${[isSelf ? "Tu" : "", player.isHost ? "Host" : "", status].filter(Boolean).join(" - ")}</small>
      </div>
      <div class="top-player-bars">
        <div class="resource-bar is-health" data-tooltip="PV ${player.health}/${maxHealth}">
          <i style="width: ${healthPct}%"></i>
          <span>PV ${player.health}/${maxHealth}</span>
        </div>
        <div class="resource-bar is-mana" data-tooltip="Mana ${player.mana}/${maxMana}">
          <i style="width: ${manaPct}%"></i>
          <span>Mana ${player.mana}/${maxMana}</span>
        </div>
      </div>
      <div class="top-card-strip">
        ${
          cards.length
            ? cards
                .map(
                  (card) => {
                    const cooldown = Number(player.cooldowns?.[card.id] ?? 0);
                    return `
                    <span class="top-card-thumb ${cooldown > 0 ? "is-cooling" : ""}" data-tooltip="${escapeAttr(card.name ?? card.id)}${cooldown > 0 ? escapeAttr(` - cooldown ${cooldown}`) : ""}">
                      <img data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="${escapeAttr(card.name ?? card.id)}" />
                      ${cooldown > 0 ? `<b>${cooldown}</b>` : ""}
                    </span>
                  `;
                  }
                )
                .join("")
            : `<i></i>`
        }
      </div>
    </article>
  `;
}

function renderMiniResource(label, value, max, kind) {
  const pct = percent(value, max);
  return `
    <div class="resource-bar is-${escapeAttr(kind)}" data-tooltip="${escapeAttr(`${label} ${value}/${max}`)}">
      <i style="width: ${pct}%"></i>
      <span>${escapeHtml(label)} ${value}/${max}</span>
    </div>
  `;
}

function renderDockCard(card) {
  if (!card) {
    return `
      <div class="dock-card is-empty">
        <div class="dock-card-art"><span>?</span></div>
      </div>
    `;
  }

  return `
    <div class="dock-card">
      <div class="dock-card-art">
        <span>${escapeHtml(getInitials(card.name))}</span>
        <img data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
      </div>
    </div>
  `;
}

function renderDockStats(card, plan = appState.plan) {
  const influences = getStatInfluences(card, plan);
  const valerio = getCardValerio(card);
  return `
    <div class="dock-card-stats">
      <div class="dock-stat-row">
        ${VALERIO_KEYS.map((key) => {
          const value = Number(valerio[key] ?? 0);
          const influence = influences[key] ?? "";
          return `
            <span
              class="stat-tile rich-tooltip stat-${key.toLowerCase()} ${influence ? `is-${influence}-boosted` : ""}"
              data-tooltip=""
            >
              <b>${value}</b>
              <small>${key}</small>
              ${renderTooltipContent(getStatInfluenceTitle(card, key, influence, value, plan))}
            </span>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderDockTrait(card, plan = appState.plan, evaluate = true) {
  const trait = evaluate ? getTraitPreview(card, plan) : {
    applied: false,
    boostedStats: [],
    title: `${card?.passive?.name ?? "Tratto"}: ${card?.passive?.text ?? ""}`
  };
  return `
    <div class="dock-trait rich-tooltip ${trait.applied ? "is-active" : ""}" data-tooltip="">
      <span class="trait-mark">P</span>
      <strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong>
      ${renderTooltipContent(trait.title)}
    </div>
  `;
}

function renderCardElement({ card, selected, disabled, draggable = false, cooldown = 0 }) {
  const dragClass = appState.draggedCardId === card.id ? "is-dragging" : "";
  return `
    <div
      class="hand-card-wrap ${dragClass}"
      data-card-id="${escapeAttr(card.id)}"
      ${draggable ? `data-draggable-card draggable="true"` : ""}
    >
      <game-card
        data-card-id="${escapeAttr(card.id)}"
        data-action-name="select-card"
        data-selected="${selected ? "true" : "false"}"
        data-disabled="${disabled ? "true" : "false"}"
        data-cooldown="${cooldown}"
        class="${selected ? "is-selected" : ""}"
      ></game-card>
    </div>
  `;
}

function renderDraftCard(item, selected = false) {
  const card = item.card;
  return `
    <div class="draft-card-wrap ${selected ? "is-previewed" : ""} ${item.isAvailable ? "" : "is-taken"} ${item.isAvailable && !item.canAfford ? "is-too-expensive" : ""}">
      <game-card
        data-card-id="${escapeAttr(card.id)}"
        data-action-name="preview-draft-card"
        data-selected="false"
        data-disabled="false"
        class="is-draft-mini ${item.isAvailable ? "" : "is-taken"}"
      ></game-card>
      <div class="draft-card-meta">
        <span>Costo ${item.cost}</span>
        <span>ATT ${card.combat?.attackPower ?? 0}% (${item.attackPool})</span>
        <span>DIF ${card.combat?.defensePower ?? 0}% (${item.defensePool})</span>
      </div>
      ${item.isAvailable ? (item.canAfford ? "" : `<span class="taken-label is-overlay">Troppo costosa</span>`) : `<span class="taken-label is-overlay">Presa da ${escapeHtml(item.takenByName)}</span>`}
    </div>
  `;
}

function renderChosenCard(player, selfId) {
  const isSelf = player?.id === selfId;
  const roleText = isSelf ? "TU" : player?.name ?? "Player";
  const card = player?.selectedCard;

  if (!card) {
    return `
      <article class="fight-card ${isSelf ? "is-self" : "is-opponent"} is-empty">
        <span class="fight-role-tag ${isSelf ? "is-you" : "is-opponent"}">${escapeHtml(roleText)}</span>
        <strong>${escapeHtml(player?.name ?? "Player")}</strong>
        <p>${player?.alive ? "Carta coperta" : "Fuori"}</p>
      </article>
    `;
  }

  return `
    <article class="fight-card ${isSelf ? "is-self" : "is-opponent"}">
      <span class="fight-role-tag ${isSelf ? "is-you" : "is-opponent"}">${escapeHtml(roleText)}</span>
      <div class="card-image-fallback">
        <span>${escapeHtml(getInitials(card.name))}</span>
      </div>
      <img class="card-full-image" data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
      <div class="fight-body card-overlay">
        <p class="eyebrow">${isSelf ? "La tua carta" : `Carta di ${escapeHtml(player.name)}`}</p>
        <h3>${escapeHtml(card.name)}</h3>
        ${renderStats(card)}
        ${renderCombat(card)}
        <div class="mini-abilities">
          <p><strong>${escapeHtml(card.active?.name ?? "Attiva")}</strong> ${renderAbilityText(card.active?.text ?? "")}</p>
          <p><strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong> ${renderAbilityText(card.passive?.text ?? "")}</p>
        </div>
      </div>
    </article>
  `;
}

function renderPlanDistribution({ title, kind, card, opponentCard, distribution, pool, slots }) {
  const selectedStats = Object.entries(distribution)
    .filter(([, value]) => Number(value ?? 0) > 0)
    .map(([stat]) => stat);
  const used = sumDistribution(distribution);
  const remaining = Math.max(0, pool - used);
  const isPoolFull = remaining <= 0;
  return `
    <div class="choice-panel" data-plan-kind="${escapeAttr(kind)}" data-plan-slots="${slots}">
      <div class="section-title">
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
        <span data-plan-count>${selectedStats.length}/${slots} - ${used}/${pool}</span>
      </div>
      <div class="pool-meter ${isPoolFull ? "is-full" : ""}" data-plan-meter>
        <i style="width: ${percent(used, pool)}%"></i>
        <span>${isPoolFull ? "Pool massimo raggiunto" : `${remaining} punti rimasti`}</span>
      </div>
      <div class="plan-stat-list">
        ${VALERIO_KEYS.map((stat) => {
          const value = Number(distribution[stat] ?? 0);
          const selected = value > 0;
          const locked = !selected && (selectedStats.length >= slots || isPoolFull);
          const pointsLocked = locked;
          const influence = getPlanLineInfluence(card, kind, stat, appState.plan);
          return `
            <label class="plan-stat rich-tooltip ${selected ? "is-selected" : ""} ${locked || pointsLocked ? "is-locked" : ""} ${influence ? `is-${influence}-line` : ""}" data-tooltip="">
              <span class="stat-${stat.toLowerCase()}">${stat}</span>
              <strong>${escapeHtml(VALERIO_LABELS[stat])}</strong>
              <small>${Number(getCardValerio(card)[stat] ?? 0)}${opponentCard ? ` vs ${Number(getCardValerio(opponentCard)[stat] ?? 0)}` : ""}</small>
              <input
                type="range"
                min="0"
                max="${pool}"
                value="${value}"
                data-action="plan-slider"
                data-plan-kind="${escapeAttr(kind)}"
                data-plan-stat="${escapeAttr(stat)}"
                ${pointsLocked ? "disabled" : ""}
              />
              <b>${value}</b>
              ${renderTooltipContent(getPlanLineTooltip(card, kind, stat, influence))}
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFightPreviewOverview(selectedCard, opponentCard) {
  const lines = getPlanPreviewLines(selectedCard, opponentCard, appState.plan.attacks);
  return `
    <div class="fight-preview">
      <div class="fight-preview-head">
        <strong>Preview Breccia</strong>
        <span>prima della difesa avversaria</span>
      </div>
      <div class="preview-stack is-main" data-main-preview-lines>
        ${lines.length ? lines.map((line) => renderPreviewLine(line)).join("") : renderEmptyPreview()}
      </div>
    </div>
  `;
}

function renderResultRow(play) {
  return `
    <article class="result-row ${play.outcome === "win" ? "is-win" : play.outcome === "tie" ? "is-tie" : "is-lose"}">
      <div class="result-card-art">
        <span>${escapeHtml(getInitials(play.cardName))}</span>
        ${play.card ? `<img data-card-image src="${escapeAttr(cardImageSrc(play.card))}" alt="" />` : ""}
      </div>
      <div>
        <strong>${escapeHtml(play.playerName)}</strong>
        <small>${escapeHtml(play.cardName)}</small>
        ${play.card ? renderStats(play.card, Object.keys(play.attacks ?? {}), Object.keys(play.defenses ?? {})) : ""}
      </div>
      <div class="result-score">${play.breach}</div>
      <div class="result-detail">
        <div class="summary-line"><span>Danno finale</span><strong>${play.finalDamage}</strong></div>
        <div class="summary-line"><span>PV</span><strong>${play.healthBefore} -> ${play.healthAfter}</strong></div>
        <div class="summary-line"><span>Mana</span><strong>${play.manaBefore} -> ${play.manaAfter}</strong></div>
        <div class="summary-line"><span>Cap</span><strong>${play.normalDamageCap}</strong></div>
      </div>
      <div class="line-list">
        ${play.attackLines.map((line) => renderAttackLine(line)).join("")}
      </div>
      <p>${[
        play.useActive ? `Attiva ${play.activeApplied ? "usata" : "non applicata"}` : "Attiva non usata",
        play.traitNotes?.join(" / "),
        play.activeNotes?.join(" / "),
        play.defenseTraitNotes?.join(" / ")
      ].filter(Boolean).map(escapeHtml).join(" / ")}</p>
    </article>
  `;
}

function renderAttackLine(line) {
  return `
    <div class="attack-line ${line.lineDamage > 0 ? "is-hit" : ""}">
      <strong>${line.stat}</strong>
      <span class="calc-strip">
        <i class="calc-atk" data-tooltip="Punti attacco">ATK ${line.attackPoints}</i>
        <i class="calc-plus">+</i>
        <i class="calc-own" data-tooltip="VALERIO attaccante">${line.attackerValerio}</i>
        <i class="calc-minus">-</i>
        <i class="calc-enemy" data-tooltip="VALERIO difensore">OPP ${line.defenderValerio}</i>
        <i class="calc-minus">-</i>
        <i class="calc-def" data-tooltip="Difesa investita">DEF ${line.defensePoints}</i>
      </span>
      <b>${line.lineDamage}</b>
      ${line.defenseIgnored ? `<em>difesa ignorata</em>` : ""}
    </div>
  `;
}

function renderStats(card, attackKeys = [], defenseKeys = [], influenceMap = {}) {
  const valerio = getCardValerio(card);
  return `
    <div class="stats">
      ${VALERIO_KEYS.map((key) => {
        const hotClass = attackKeys.includes(key) ? "is-hot" : defenseKeys.includes(key) ? "is-cool" : "";
        const influenceClass = influenceMap[key] ? `is-${influenceMap[key]}-target` : "";
        const value = Number(valerio[key] ?? 0);
        return `
          <span class="stat-tile rich-tooltip stat-${key.toLowerCase()} ${hotClass} ${influenceClass}" data-tooltip="">
            <b>${value}</b>
            <small>${key}</small>
            ${renderTooltipContent(VALERIO_LABELS[key])}
          </span>
        `;
      }).join("")}
    </div>
  `;
}

function renderCombat(card) {
  return `
    <div class="combat-stats">
      <span>ATT ${Number(card.combat?.attackPower ?? 0)}%</span>
      <span>DIF ${Number(card.combat?.defensePower ?? 0)}%</span>
      <span>Costo ${getDraftCost(card)}</span>
    </div>
  `;
}

function renderTimer(lobby) {
  if (!lobby.deadlineAt || !["draft", "select"].includes(lobby.phase)) {
    return "";
  }

  const deadlineAt = Number(lobby.deadlineAt);
  const seconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
  return `<div class="timer-pill ${seconds <= 5 ? "is-low" : ""}" data-deadline-at="${deadlineAt}"><span>Timer</span><strong>${seconds}s</strong></div>`;
}

function renderChatMessage(message) {
  const speaker = message.kind === "system" ? "sys" : message.name ?? "player";
  return `
    <div class="chat-message ${message.kind === "system" ? "is-system" : ""}">
      <strong>${escapeHtml(speaker)}</strong>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `;
}

function renderInspectorCard(card, title) {
  return `
    <div class="inspector-card">
      <div class="inspector-art">
        <img data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
      </div>
      <div class="inspector-body">
        <p class="eyebrow">${escapeHtml(title)}</p>
        <h2>${escapeHtml(card.name)}</h2>
        ${renderStats(card)}
        ${renderCombat(card)}
        <div class="ability-box">
          <span>Attiva - ${Number(card.active?.cost ?? 0)} mana</span>
          <strong>${escapeHtml(card.active?.name ?? "Attiva")}</strong>
          <p>${renderAbilityText(card.active?.text ?? "")}</p>
        </div>
        <div class="ability-box">
          <span>Tratto</span>
          <strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong>
          <p>${renderAbilityText(card.passive?.text ?? "")}</p>
        </div>
      </div>
    </div>
  `;
}

function renderCardMath(card, title) {
  return `
    <div class="math-box">
      <h3>${escapeHtml(title)}</h3>
      <strong>${escapeHtml(card.name)}</strong>
      ${renderStats(card)}
      <div class="summary-line"><span>Pool attacco</span><strong>${getAttackPool(card)}</strong></div>
      <div class="summary-line"><span>Pool difesa</span><strong>${getDefensePool(card)}</strong></div>
      <div class="ability-box">
        <span>Attiva - ${Number(card.active?.cost ?? 0)} mana</span>
        <strong>${escapeHtml(card.active?.name ?? "Attiva")}</strong>
        <p>${renderAbilityText(card.active?.text ?? "")}</p>
      </div>
      <div class="ability-box">
        <span>Tratto - sempre attivo</span>
        <strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong>
        <p>${renderAbilityText(card.passive?.text ?? "")}</p>
      </div>
    </div>
  `;
}

function renderPlanSummary(lobby, self, selectedCard, opponent, opponentCard) {
  if (!self?.isActive || !selectedCard) {
    return `
      <div class="side-summary">
        <p class="eyebrow">Fight</p>
        <h2>Lobby duello</h2>
        <p>Le carte sono rivelate ai partecipanti. Attacchi e difese restano coperti fino al reveal.</p>
      </div>
    `;
  }

  const attackPool = getAttackPool(selectedCard);
  const defensePool = getDefensePool(selectedCard);
  const attacksUsed = sumDistribution(appState.plan.attacks);
  const defensesUsed = sumDistribution(appState.plan.defenses);
  const previewLines = getPlanPreviewLines(selectedCard, opponentCard, appState.plan.attacks);

  return `
    <div class="side-summary opponent-summary">
      <p class="eyebrow">Target</p>
      <h2>${escapeHtml(opponent?.name ?? "Avversario")}</h2>
      ${opponentCard ? renderOpponentInfoCard(opponent, opponentCard, lobby.settings ?? appState.snapshot?.settings ?? {}) : `<p class="empty">Carta avversaria non disponibile.</p>`}
      <div class="summary-line"><span>Attacco</span><strong>${attacksUsed}/${attackPool}</strong></div>
      <div class="summary-line"><span>Difesa</span><strong>${defensesUsed}/${defensePool}</strong></div>
      <div class="summary-line"><span>Mana previsto</span><strong>${appState.plan.useActive ? Math.max(0, self.mana - Number(selectedCard.active?.cost ?? 0)) : self.mana}</strong></div>
      <div class="preview-stack" data-plan-preview-lines>
        ${previewLines.length ? previewLines.map((line) => renderPreviewLine(line)).join("") : renderEmptyPreview()}
      </div>
    </div>
  `;
}

function renderOpponentInfoCard(opponent, card, settings = {}) {
  const maxHealth = Number(opponent?.maxHealth ?? settings.maxHealth ?? 50);
  const maxMana = Number(settings.maxMana ?? 10);
  return `
    <div class="opponent-hud-card">
      <div class="opponent-card-art">
        <span>${escapeHtml(getInitials(card.name))}</span>
        <img data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
      </div>
      <div class="opponent-hud-body">
        <div class="opponent-hud-title">
          <strong>${escapeHtml(opponent?.name ?? "Avversario")}</strong>
          <span>${escapeHtml(card.name)}</span>
        </div>
        <div class="opponent-hud-bars">
          ${renderMiniResource("PV", opponent?.health ?? 0, maxHealth, "health")}
          ${renderMiniResource("Mana", opponent?.mana ?? 0, maxMana, "mana")}
        </div>
      </div>
    </div>
    <div class="opponent-card-info">
      <div class="opponent-card-body">
        ${renderStats(card)}
        ${renderCombat(card)}
      </div>
    </div>
    <div class="ability-box is-compact">
      <span>Attiva - ${Number(card.active?.cost ?? 0)} mana</span>
      <strong>${escapeHtml(card.active?.name ?? "Attiva")}</strong>
      <p>${renderAbilityText(card.active?.text ?? "")}</p>
    </div>
    <div class="ability-box is-compact">
      <span>Tratto</span>
      <strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong>
      <p>${renderAbilityText(card.passive?.text ?? "")}</p>
    </div>
  `;
}

function getPlanPreviewLines(selectedCard, opponentCard, attacks) {
  if (!selectedCard || !opponentCard) {
    return [];
  }

  return Object.entries(attacks ?? {})
    .filter(([, points]) => Number(points ?? 0) > 0)
    .map(([stat, points]) => {
      const mine = Number(getCardValerio(selectedCard)[stat] ?? 0);
      const enemy = Number(getCardValerio(opponentCard)[stat] ?? 0);
      const raw = Number(points) + mine - enemy;
      return { stat, points: Number(points), mine, enemy, result: Math.max(0, raw) };
    });
}

function renderPreviewLine(line) {
  return `
    <div class="preview-line">
      <strong>${escapeHtml(line.stat)}</strong>
      <span class="calc-strip">
        <i class="calc-atk" data-tooltip="Punti attacco investiti">ATK ${line.points}</i>
        <i class="calc-plus">+</i>
        <i class="calc-own" data-tooltip="VALERIO tuo">TU ${line.mine}</i>
        <i class="calc-minus">-</i>
        <i class="calc-enemy" data-tooltip="VALERIO avversario">OPP ${line.enemy}</i>
        <i class="calc-equals">=</i>
        <i class="calc-result" data-tooltip="Breccia prima della difesa">${line.result}</i>
      </span>
      <small>prima della difesa</small>
    </div>
  `;
}

function renderEmptyPreview() {
  return `<p class="empty preview-empty">Muovi gli slider di attacco per vedere la previsione.</p>`;
}

function renderResultSummary(result, selfId) {
  if (!result) {
    return `<div class="side-summary"><h2>Nessun risultato</h2></div>`;
  }

  const selfPlay = result.plays.find((play) => play.playerId === selfId);
  const opponentPlay = result.plays.find((play) => play.playerId !== selfId);
  const winnerPlay = result.winnerId ? result.plays.find((play) => play.playerId === result.winnerId) : null;
  return `
    <div class="side-summary">
      <p class="eyebrow">${selfPlay ? result.winnerId ? `Perche ${selfPlay.outcome === "win" ? "hai vinto" : "hai perso"}` : "Perche e pari" : "Risultato duello"}</p>
      <h2>${winnerPlay ? escapeHtml(winnerPlay.playerName) : "Pareggio"}</h2>
      <p>${escapeHtml(result.summary?.reason ?? "")}</p>
      ${
        selfPlay && opponentPlay
          ? `
            <div class="summary-line"><span>La tua Breccia</span><strong>${selfPlay.breach}</strong></div>
            <div class="summary-line"><span>Breccia avversaria</span><strong>${opponentPlay.breach}</strong></div>
            <div class="summary-line"><span>Danno subito</span><strong>${selfPlay.damageTaken}</strong></div>
            <div class="summary-line"><span>PV</span><strong>${selfPlay.healthBefore} -> ${selfPlay.healthAfter}</strong></div>
            <div class="summary-line"><span>Mana</span><strong>${selfPlay.manaBefore} -> ${selfPlay.manaAfter}</strong></div>
          `
          : ""
      }
      ${(result.summary?.lines ?? []).slice(0, 6).map((line) => `<p class="math-line">${escapeHtml(line.text)}</p>`).join("")}
    </div>
  `;
}

function syncHandOrder(hand) {
  const ids = hand.map((card) => card.id);
  appState.handOrder = appState.handOrder.filter((cardId) => ids.includes(cardId));
  for (const cardId of ids) {
    if (!appState.handOrder.includes(cardId)) {
      appState.handOrder.push(cardId);
    }
  }
}

function orderCards(cards) {
  syncHandOrder(cards);
  const indexById = new Map(appState.handOrder.map((cardId, index) => [cardId, index]));
  return [...cards].sort((left, right) => (indexById.get(left.id) ?? 999) - (indexById.get(right.id) ?? 999));
}

function moveHandCard(draggedCardId, targetCardId) {
  if (!draggedCardId || !targetCardId || draggedCardId === targetCardId) {
    return false;
  }

  const nextOrder = appState.handOrder.filter((cardId) => cardId !== draggedCardId);
  const targetIndex = nextOrder.indexOf(targetCardId);
  if (targetIndex < 0) {
    return false;
  }

  nextOrder.splice(targetIndex, 0, draggedCardId);
  if (nextOrder.join("|") === appState.handOrder.join("|")) {
    return false;
  }
  appState.handOrder = nextOrder;
  return true;
}

function updatePlanPoints(kind, stat, rawValue) {
  const lobby = appState.snapshot?.lobby;
  const card = getCardById(lobby?.self?.selected?.cardId);
  const distribution = appState.plan[kind];
  if (!card || !distribution || !VALERIO_KEYS.includes(stat)) {
    return;
  }

  const pool = kind === "attacks" ? getAttackPool(card) : getDefensePool(card);
  const positiveStats = Object.entries(distribution).filter(([, value]) => Number(value ?? 0) > 0);
  const isNewPositive = Number(distribution[stat] ?? 0) <= 0 && Number(rawValue || 0) > 0;
  if (isNewPositive && positiveStats.length >= 3) {
    return;
  }

  const others = Object.entries(distribution)
    .filter(([key]) => key !== stat)
    .reduce((total, [, value]) => total + Number(value ?? 0), 0);
  const value = clamp(Math.floor(Number(rawValue || 0)), 0, Math.max(0, pool - others));
  if (value <= 0) {
    delete distribution[stat];
  } else {
    distribution[stat] = value;
  }
}

function getPlanValidation(lobby, card) {
  const attackCount = Object.values(appState.plan.attacks).filter((value) => Number(value ?? 0) > 0).length;
  const defenseCount = Object.values(appState.plan.defenses).filter((value) => Number(value ?? 0) > 0).length;
  const attackTotal = sumDistribution(appState.plan.attacks);
  const defenseTotal = sumDistribution(appState.plan.defenses);
  const attackPool = getAttackPool(card);
  const defensePool = getDefensePool(card);
  const attackSlots = lobby.settings?.attackSlots ?? 3;
  const defenseSlots = lobby.settings?.defenseSlots ?? 3;

  if (attackCount < 1) {
    return { ok: false, error: "Metti almeno 1 punto in attacco." };
  }
  if (attackCount > attackSlots) {
    return { ok: false, error: `Puoi attaccare massimo ${attackSlots} statistiche.` };
  }
  if (defenseCount < 1) {
    return { ok: false, error: "Metti almeno 1 punto in difesa." };
  }
  if (defenseCount > defenseSlots) {
    return { ok: false, error: `Puoi difendere massimo ${defenseSlots} statistiche.` };
  }
  if (attackTotal > attackPool) {
    return { ok: false, error: `Attacco oltre pool: ${attackTotal}/${attackPool}.` };
  }
  if (defenseTotal > defensePool) {
    return { ok: false, error: `Difesa oltre pool: ${defenseTotal}/${defensePool}.` };
  }
  if (appState.plan.useActive && !canUseActive(card, lobby.self)) {
    return { ok: false, error: "Mana insufficiente per l'attiva." };
  }

  return { ok: true, error: "" };
}

function makeDefaultPlan(card, self) {
  return {
    cardId: card.id,
    attacks: makeDefaultDistribution(getAttackPool(card)),
    defenses: makeDefaultDistribution(getDefensePool(card)),
    useActive: false && canUseActive(card, self)
  };
}

function makeDefaultDistribution(pool) {
  return {};
}

function resetPlan() {
  appState.plan = {
    cardId: "",
    attacks: {},
    defenses: {},
    useActive: false
  };
}

function captureInputFocus(input, extra) {
  let start = null;
  let end = null;
  try {
    start = input.selectionStart;
    end = input.selectionEnd;
  } catch {
    start = null;
    end = null;
  }

  return {
    ...extra,
    value: input.value,
    start,
    end
  };
}

function syncPlanPanel(panel, card) {
  const kind = panel.dataset.planKind;
  const slots = Number(panel.dataset.planSlots ?? 3);
  const distribution = appState.plan[kind] ?? {};
  const pool = kind === "attacks" ? getAttackPool(card) : getDefensePool(card);
  const selectedStats = Object.entries(distribution)
    .filter(([, value]) => Number(value ?? 0) > 0)
    .map(([stat]) => stat);
  const used = sumDistribution(distribution);
  const remaining = Math.max(0, pool - used);
  const isPoolFull = remaining <= 0;

  const count = panel.querySelector("[data-plan-count]");
  if (count) {
    count.textContent = `${selectedStats.length}/${slots} - ${used}/${pool}`;
  }

  const meter = panel.querySelector("[data-plan-meter]");
  if (meter) {
    meter.classList.toggle("is-full", isPoolFull);
    meter.querySelector("i").style.width = `${percent(used, pool)}%`;
    meter.querySelector("span").textContent = isPoolFull ? "Pool massimo raggiunto" : `${remaining} punti rimasti`;
  }

  panel.querySelectorAll('[data-action="plan-slider"]').forEach((input) => {
    const stat = input.dataset.planStat;
    const value = Number(distribution[stat] ?? 0);
    const selected = value > 0;
    const locked = !selected && (selectedStats.length >= slots || isPoolFull);
    const label = input.closest(".plan-stat");
    const influence = getPlanLineInfluence(card, kind, stat, appState.plan);

    input.max = String(pool);
    input.value = String(value);
    input.disabled = locked;

    label?.classList.toggle("is-selected", selected);
    label?.classList.toggle("is-locked", locked);
    label?.classList.toggle("is-trait-line", influence === "trait");
    label?.classList.toggle("is-active-line", influence === "active");
    label?.classList.toggle("is-both-line", influence === "both");
    if (label) {
      label.dataset.tooltip = "";
      const tooltip = label.querySelector(".tooltip-content");
      if (tooltip) {
        tooltip.innerHTML = renderAbilityText(getPlanLineTooltip(card, kind, stat, influence, appState.plan));
      }
    }
    const valueBadge = label?.querySelector("b");
    if (valueBadge) {
      valueBadge.textContent = String(value);
    }
  });
}

function getActivePlayers(lobby) {
  return (lobby.activePair ?? []).map((playerId) => lobby.players.find((player) => player.id === playerId)).filter(Boolean);
}

function getPlayerName(lobby, playerId) {
  return lobby.players.find((player) => player.id === playerId)?.name;
}

function getDockCard(lobby) {
  const self = lobby?.self;
  if (!self) {
    return null;
  }

  if (lobby.phase === "draft") {
    return getDraftPreviewCard(lobby);
  }

  if (lobby.phase === "select") {
    return getCardById(appState.selectedCardId) ?? self.selected?.selectedCard ?? null;
  }

  if (["plan", "reveal", "ended"].includes(lobby.phase)) {
    return self.selected?.selectedCard ?? getCardById(self.selected?.cardId) ?? null;
  }

  return null;
}

function getManaPreview(lobby, self, card, settings = {}) {
  const mana = Number(self?.mana ?? 0);
  if (lobby?.phase === "plan" && appState.plan.useActive && card && canUseActive(card, self)) {
    return Math.max(0, mana - Number(card.active?.cost ?? 0));
  }
  return Math.min(Number(settings.maxMana ?? 10), mana);
}

function getTraitPreview(card, plan = appState.plan) {
  const effect = card?.passive?.effect ?? {};
  const stat = effect.stat;
  const attacks = plan?.attacks ?? {};
  const defenses = plan?.defenses ?? {};
  const hasAttack = VALERIO_KEYS.includes(stat) && Number(attacks[stat] ?? 0) > 0;
  const hasDefense = VALERIO_KEYS.includes(stat) && Number(defenses[stat] ?? 0) > 0;
  const value = Number(effect.value ?? 0);
  const baseTitle = `${card?.passive?.name ?? "Tratto"}: ${card?.passive?.text ?? ""}`;
  const statLabel = VALERIO_LABELS[stat] ?? "stat";

  switch (effect.type) {
    case "attack-stat-bonus":
      return {
        applied: hasAttack,
        boostedStats: hasAttack ? [stat] : [],
        title: `${baseTitle} ${hasAttack ? `Attivo: +${value} Breccia su ${statLabel}.` : `Si attiva attaccando con ${statLabel}.`}`
      };
    case "defense-stat-bonus":
      return {
        applied: hasDefense,
        boostedStats: hasDefense ? [stat] : [],
        title: `${baseTitle} ${hasDefense ? `Attivo: +${value} difesa su ${statLabel}.` : `Si attiva difendendo ${statLabel}.`}`
      };
    case "flat-damage":
    case "score":
      return {
        applied: true,
        boostedStats: [],
        title: `${baseTitle} Sempre attivo: +${value} Breccia.`
      };
    case "contains":
      return {
        applied: hasAttack || hasDefense,
        boostedStats: hasAttack || hasDefense ? [stat] : [],
        title: `${baseTitle} Si attiva usando ${statLabel} in attacco o difesa.`
      };
    case "missing": {
      const applied = VALERIO_KEYS.includes(stat) && !hasAttack && !hasDefense;
      return {
        applied,
        boostedStats: applied ? [stat] : [],
        title: `${baseTitle} Si attiva se non usi ${statLabel}.`
      };
    }
    case "defense-hit-bonus":
      return {
        applied: false,
        boostedStats: [],
        title: `${baseTitle} Condizionale: dipende dagli attacchi avversari.`
      };
    default:
      return {
        applied: false,
        boostedStats: [],
        title: baseTitle
      };
  }
}

function getActiveInfluencedStats(card, plan = appState.plan) {
  if (!plan?.useActive) {
    return [];
  }

  const effect = card?.active?.effect ?? {};
  if (
    ["ignore-defense", "selected-stat"].includes(effect.type) &&
    VALERIO_KEYS.includes(effect.stat) &&
    Number(plan.attacks?.[effect.stat] ?? 0) > 0
  ) {
    return [effect.stat];
  }

  const count = Number(effect.count ?? 0);
  if (["ignore-defense", "selected-stat"].includes(effect.type) && count > 0) {
    return Object.entries(plan.attacks ?? {})
      .filter(([, value]) => Number(value ?? 0) > 0)
      .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0))
      .slice(0, count)
      .map(([stat]) => stat);
  }

  return [];
}

function getStatInfluences(card, plan = appState.plan) {
  const passiveStats = new Set(getOwnValueBoostStats(card?.passive?.effect, plan));
  const activeStats = new Set(plan?.useActive ? getOwnValueBoostStats(card?.active?.effect, plan) : []);
  const result = {};

  for (const key of VALERIO_KEYS) {
    const passive = passiveStats.has(key);
    const active = activeStats.has(key);
    if (passive && active) {
      result[key] = "both";
    } else if (passive) {
      result[key] = "trait";
    } else if (active) {
      result[key] = "active";
    }
  }

  return result;
}

function getOwnValueBoostStats(effect, plan = appState.plan) {
  if (!effect?.type) {
    return [];
  }

  if (["valerio-bonus", "stat-bonus", "self-stat-bonus"].includes(effect.type) && VALERIO_KEYS.includes(effect.stat)) {
    return [effect.stat];
  }

  return [];
}

function getPlanLineInfluence(card, kind, stat, plan = appState.plan) {
  const traitStats = getTraitLineStats(card?.passive?.effect, kind, plan);
  const activeStats = kind === "attacks" ? getActiveInfluencedStats(card, plan) : [];
  const trait = traitStats.includes(stat);
  const active = activeStats.includes(stat);

  if (trait && active) return "both";
  if (trait) return "trait";
  if (active) return "active";
  return "";
}

function getPlanLineTooltip(card, kind, stat, influence, plan = appState.plan) {
  const label = VALERIO_LABELS[stat] ?? stat;
  const mode = kind === "attacks" ? "attacco" : "difesa";
  const notes = [`${label}: slider ${mode}`];
  const trait = getTraitPreview(card, plan);

  if (influence === "trait" || influence === "both") {
    notes.push(`Tratto: ${trait.title}`);
  }

  if (influence === "active" || influence === "both") {
    notes.push(`Attiva: ${card?.active?.text ?? card?.active?.name ?? "effetto attivo"}`);
  }

  return notes.join(" - ");
}

function getTraitLineStats(effect, kind, plan = appState.plan) {
  if (!effect?.type || !VALERIO_KEYS.includes(effect.stat)) {
    return [];
  }

  if (kind === "attacks" && ["attack-stat-bonus", "contains"].includes(effect.type) && Number(plan.attacks?.[effect.stat] ?? 0) > 0) {
    return [effect.stat];
  }

  if (kind === "defenses" && ["defense-stat-bonus", "contains"].includes(effect.type) && Number(plan.defenses?.[effect.stat] ?? 0) > 0) {
    return [effect.stat];
  }

  return [];
}

function getOpponentStatInfluences(card, plan = appState.plan) {
  const result = {};
  for (const stat of VALERIO_KEYS) {
    const influence = getPlanLineInfluence(card, "attacks", stat, plan);
    if (influence) {
      result[stat] = influence;
    }
  }
  return result;
}

function getStatInfluenceTitle(card, stat, influence, value, plan = appState.plan) {
  const base = `${VALERIO_LABELS[stat]} originale: ${value}`;
  const trait = getTraitPreview(card, plan);
  const activeText = card?.active?.text ? `Attiva: ${card.active.text}` : "Attiva";

  if (influence === "both") {
    return `${base} - Passiva: ${trait.title} - ${activeText}`;
  }
  if (influence === "trait") {
    return `${base} - Passiva: ${trait.title}`;
  }
  if (influence === "active") {
    return `${base} - ${activeText}`;
  }

  return base;
}

function getDockAction(lobby, snapshot, isHost) {
  const self = lobby.self;
  if (!self) {
    return { state: "Fuori lobby", detail: "", action: "noop", label: "Aspetta", enabled: false };
  }

  if (lobby.phase === "lobby") {
    const canStart = isHost && lobby.players.length >= snapshot.settings.minPlayers;
    return {
      state: isHost ? "Host lobby" : "In lobby",
      detail: canStart ? "Puoi iniziare la partita." : `Servono ${snapshot.settings.minPlayers} player.`,
      action: "start",
      label: isHost ? "Inizia" : "Aspetta host",
      enabled: canStart
    };
  }

  if (lobby.phase === "draft") {
    const previewCard = getDraftPreviewCard(lobby);
    const currentName = getPlayerName(lobby, lobby.draft?.currentPlayerId) ?? "Player";
    return {
      state: self.isCurrentDrafter ? "Tocca a te" : `Draft: ${currentName}`,
      detail: self.isCurrentDrafter
        ? `${previewCard?.name ?? "Seleziona una carta"} - budget ${self.draftBudgetRemaining}`
        : "Aspetta il tuo turno.",
      action: "draft-selected-card",
      cardId: previewCard?.id ?? "",
      label: self.isCurrentDrafter ? "Drafta" : "Aspetta turno",
      enabled: canDraftPreview(lobby, previewCard)
    };
  }

  if (lobby.phase === "select") {
    const selectedCard = getCardById(appState.selectedCardId);
    const alreadySelected = Boolean(self.selected?.cardId);
    return {
      state: self.isActive ? "Scegli carta" : "Spettatore",
      detail: self.isActive ? selectedCard?.name ?? "Nessuna carta disponibile" : "Non sei nel duello corrente.",
      action: "submit-card",
      label: alreadySelected ? "Carta scelta" : self.isActive ? "Seleziona" : "Aspetta turno",
      enabled: Boolean(self.isActive && selectedCard && !alreadySelected)
    };
  }

  if (lobby.phase === "plan") {
    const selectedCard = getCardById(self.selected?.cardId);
    const validation = selectedCard ? getPlanValidation(lobby, selectedCard) : { ok: false, error: "Carta mancante" };
    const submitted = Boolean(self.selected?.attacks && self.selected?.defenses);
    return {
      state: self.isActive ? "Piano fight" : "Spettatore",
      detail: submitted ? "Piano confermato." : validation.ok ? "Pronto a confermare." : validation.error,
      action: "submit-plan",
      label: submitted ? "Aspetta reveal" : self.isActive ? "Conferma" : "Aspetta turno",
      enabled: Boolean(self.isActive && !submitted && validation.ok)
    };
  }

  if (lobby.phase === "reveal") {
    return {
      state: "Reveal",
      detail: lobby.lastResult?.summary?.reason ?? "Round concluso.",
      action: "next-round",
      label: isHost ? "Prossimo" : "Aspetta host",
      enabled: isHost
    };
  }

  if (lobby.phase === "ended") {
    return {
      state: "Fine partita",
      detail: lobby.winnerId ? `${getPlayerName(lobby, lobby.winnerId)} vince.` : "Partita chiusa.",
      action: "restart",
      label: isHost ? "Reset" : "Fine",
      enabled: isHost
    };
  }

  return { state: phaseLabel(lobby.phase), detail: "", action: "noop", label: "Aspetta", enabled: false };
}

function getDraftPreviewItem(lobby) {
  const pool = lobby?.draft?.pool ?? [];
  return (
    pool.find((item) => item.card?.id === appState.draftPreviewCardId) ??
    pool.find((item) => item.canPick) ??
    pool.find((item) => item.isAvailable) ??
    pool[0] ??
    null
  );
}

function getDraftPreviewCard(lobby) {
  return getDraftPreviewItem(lobby)?.card ?? null;
}

function canDraftPreview(lobby, card) {
  if (!card || !lobby?.self?.isCurrentDrafter) {
    return false;
  }

  return Boolean(getDraftPreviewItem(lobby)?.card?.id === card.id && getDraftPreviewItem(lobby)?.canPick);
}

function canUseActive(card, self) {
  return Boolean(card && self && self.mana >= Number(card.active?.cost ?? 0));
}

function isCardCooling(player, cardId) {
  return Number(player?.cooldowns?.[cardId] ?? 0) > 0;
}

function getPlayerStatus(player, phase) {
  if (!player.alive) {
    return "Fuori";
  }

  if (phase === "select") {
    return player.hasSelected ? "Carta scelta" : "Sceglie carta";
  }

  if (phase === "draft") {
    return player.isCurrentDrafter ? "Sta draftando" : `${player.draftCount} carte`;
  }

  if (phase === "plan") {
    return player.hasSubmittedPlan ? "Piano pronto" : "Prepara piano";
  }

  return "In gioco";
}

function phaseLabel(phase) {
  return {
    lobby: "Codice",
    draft: "Draft",
    select: "Scelta carta",
    plan: "Fight",
    reveal: "Risultato",
    ended: "Fine"
  }[phase] ?? "Codice";
}

function getCardById(cardId) {
  return cardId ? appState.cardsById.get(cardId) : null;
}

function readCards(data) {
  return Array.isArray(data) ? data : data.cards ?? [];
}

function getCardValerio(card) {
  return card?.valerio ?? card?.special ?? {};
}

function getCardCombat(card) {
  return card?.combat ?? {};
}

function getAttackPool(card) {
  return Math.floor((20 * Number(getCardCombat(card).attackPower ?? 0)) / 100);
}

function getDefensePool(card) {
  return Math.floor((20 * Number(getCardCombat(card).defensePower ?? 0)) / 100);
}

function getDraftCost(card) {
  const combat = getCardCombat(card);
  if (Number.isInteger(combat.draftCost)) {
    return combat.draftCost;
  }

  const totalPower = Number(combat.attackPower ?? 0) + Number(combat.defensePower ?? 0);
  if (totalPower <= 100) return 2;
  if (totalPower <= 130) return 3;
  if (totalPower <= 160) return 4;
  if (totalPower <= 180) return 5;
  return 6;
}

function sumDistribution(distribution) {
  return Object.values(distribution ?? {}).reduce((total, value) => total + Number(value ?? 0), 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function percent(value, max) {
  if (!max || max <= 0) {
    return 0;
  }

  return clamp(Math.round((Number(value ?? 0) / max) * 100), 0, 100);
}

function cardImageSrc(card) {
  return `/cards/${encodeURIComponent(card.id)}.png`;
}

function getInitials(name) {
  return String(name)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function send(type, payload = {}) {
  if (appState.socket?.readyState === WebSocket.OPEN) {
    appState.socket.send(JSON.stringify({ type, payload }));
  }
}

function renderTooltipContent(value) {
  return `<div class="tooltip-content">${renderAbilityText(value)}</div>`;
}

function renderAbilityText(value) {
  const text = String(value ?? "");
  const statPattern = /(?:(?:[+-]?\d+)\s+(?:punti|Breccia)\s+)?(?:Vigore|Astuzia|Lucidita|Lucidità|Ego|Rigore|Istinto|Opportunismo)\b/gi;
  let output = "";
  let lastIndex = 0;

  for (const match of text.matchAll(statPattern)) {
    const start = match.index ?? 0;
    const chunk = match[0];
    const stat = getStatFromText(chunk);

    output += escapeHtml(text.slice(lastIndex, start));
    output += stat
      ? `<strong class="valerio-term stat-${stat.toLowerCase()}">${escapeHtml(chunk)}</strong>`
      : escapeHtml(chunk);
    lastIndex = start + chunk.length;
  }

  output += escapeHtml(text.slice(lastIndex));
  return output;
}

function getStatFromText(value) {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const [key, label] of Object.entries(VALERIO_LABELS)) {
    const normalizedLabel = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (normalized.includes(normalizedLabel)) {
      return key;
    }
  }

  return "";
}

function getLastChatMessageId(lobby) {
  const chat = lobby?.chat ?? [];
  return chat.at(-1)?.id ?? "";
}

function scheduleChatHide(onHide, delayMs = 10000) {
  clearChatHideTimer();
  appState.chatHideTimer = window.setTimeout(() => {
    appState.chatVisible = false;
    appState.chatHideTimer = null;
    onHide?.();
  }, delayMs);
}

function clearChatHideTimer() {
  if (appState.chatHideTimer) {
    window.clearTimeout(appState.chatHideTimer);
    appState.chatHideTimer = null;
  }
}

function readChatPosition() {
  try {
    const raw = localStorage.getItem("vtg:chat-position");
    if (!raw) {
      return null;
    }

    const position = JSON.parse(raw);
    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      return {
        x: clamp(Number(position.x), 8, Math.max(8, window.innerWidth - 320)),
        y: clamp(Number(position.y), 8, Math.max(8, window.innerHeight - 220))
      };
    }
  } catch {
    return null;
  }

  return null;
}

function writeChatPosition(position) {
  if (!position) {
    return;
  }

  localStorage.setItem("vtg:chat-position", JSON.stringify(position));
}

function isTypingTarget(target) {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return false;
  }

  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

function isChatTarget(target) {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest("[data-chat-window]"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
