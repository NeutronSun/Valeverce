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
  plan: {
    cardId: "",
    attacks: {},
    defenses: {},
    useActive: false
  },
  handOrder: [],
  draggedCardId: "",
  justDraggedUntil: 0
};

class GameApp extends HTMLElement {
  connectedCallback() {
    this.clock = window.setInterval(() => this.updateTimers(), 250);
    this.loadCards();
    this.connect();
    this.render();
  }

  disconnectedCallback() {
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
        appState.snapshot = message;
        appState.selfId = message.selfId;
        this.keepSelectionValid();
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

    this.innerHTML = `
      <main class="shell">
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
        ${appState.lastError ? `<p class="toast">${escapeHtml(appState.lastError)}</p>` : ""}
        ${lobby ? this.renderLobby(lobby, snapshot) : this.renderHome(snapshot)}
      </main>
    `;

    this.bindEvents();
    this.restoreFocusState(focusState);
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

    if (active?.dataset?.action === "plan-points") {
      return captureInputFocus(active, {
        kind: "plan-points",
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
    if (focusState.kind === "plan-points") {
      input = this.querySelector(
        `[data-action="plan-points"][data-plan-kind="${focusState.planKind}"][data-plan-stat="${focusState.planStat}"]`
      );
    }

    if (!input) {
      return;
    }

    input.value = focusState.value;
    input.focus();
    if (typeof focusState.start === "number" && typeof focusState.end === "number") {
      input.setSelectionRange(focusState.start, focusState.end);
    }
  }

  scrollChatToBottom() {
    const chatLog = this.querySelector(".chat-log");
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
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

  renderLobby(lobby, snapshot) {
    const isHost = lobby.hostId === snapshot.selfId;
    return `
      <section class="panel lobby-head">
        <div class="lobby-player-summary">
          <div>
            <p class="eyebrow">Player</p>
            <h2>${lobby.players.length}/${snapshot.settings.maxPlayers}</h2>
          </div>
          <div class="top-players">
            ${lobby.players.map((player) => renderTopPlayer(player, lobby.phase, snapshot.settings)).join("")}
          </div>
        </div>
        <div class="actions">
          ${isHost && lobby.phase === "lobby" ? `<button type="button" data-action="start">Inizia</button>` : ""}
          ${isHost && lobby.phase === "reveal" ? `<button type="button" data-action="next-round">Prossimo turno</button>` : ""}
          ${isHost && lobby.phase === "ended" ? `<button type="button" data-action="restart">Reset</button>` : ""}
          <button type="button" class="ghost" data-action="leave">Esci</button>
        </div>
      </section>
      <section class="layout">
        <aside class="panel left-rail">
          ${this.renderChat(lobby)}
        </aside>
        <section class="panel table">
          ${this.renderPhase(lobby, snapshot)}
        </section>
        <aside class="panel right-rail">
          ${this.renderSidePanel(lobby, snapshot)}
        </aside>
      </section>
    `;
  }

  renderChat(lobby) {
    return `
      <div class="chat">
        <div class="section-title">
          <h2>Chat</h2>
          <span>${lobby.chat?.length ?? 0}</span>
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

  renderSidePanel(lobby, snapshot) {
    const self = lobby.self;
    const activePlayers = getActivePlayers(lobby);
    const opponent = activePlayers.find((player) => player.id !== snapshot.selfId);
    const selectedCard =
      lobby.phase === "select" ? getCardById(appState.selectedCardId) : getCardById(self?.selected?.cardId);
    const opponentCard = opponent?.selectedCard;

    if (lobby.phase === "draft") {
      return `
        <div class="side-summary">
          <p class="eyebrow">Draft</p>
          <h2>${self?.isCurrentDrafter ? "Tocca a te" : "In attesa"}</h2>
          <p>${escapeHtml(getPlayerName(lobby, lobby.draft?.currentPlayerId) ?? "Player")} sta scegliendo.</p>
          <div class="summary-line"><span>Carte</span><strong>${self?.deck.length ?? 0}/${lobby.draft?.target ?? 6}</strong></div>
          <div class="summary-line"><span>Budget usato</span><strong>${self?.draftSpent ?? 0}/${self?.draftBudget ?? 20}</strong></div>
          <div class="summary-line"><span>Rimanente</span><strong>${self?.draftBudgetRemaining ?? 0}</strong></div>
          <div class="summary-line"><span>Pool rimasto</span><strong>${(lobby.draft?.pool ?? []).filter((item) => item.isAvailable).length}</strong></div>
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
        <span class="muted">Costo carta rispettato dal server</span>
      </div>
      <div class="draft-picked">
        <strong>Le tue carte draftate</strong>
        <div>${(self?.deck ?? []).map((card) => `<span>${escapeHtml(card.name)}</span>`).join("") || "<span>Nessuna</span>"}</div>
      </div>
      <div class="draft-pool">
        ${(lobby.draft?.pool ?? []).map((item) => renderDraftCard(item)).join("")}
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
              <button type="button" data-action="submit-card" ${selectedCard && !alreadyPlayed ? "" : "disabled"}>
                ${alreadyPlayed ? "Carta scelta" : "Conferma carta"}
              </button>
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
      <div class="fight-flow">
        <div><strong>1</strong><span>Carte rivelate</span></div>
        <div><strong>2</strong><span>Distribuisci attacco e difesa</span></div>
        <div><strong>3</strong><span>Reveal Breccia e danno PV</span></div>
      </div>
      <div class="fight-board ${isParticipant ? "" : "is-spectator"} plan-board">
        ${
          isParticipant
            ? `
              <section class="fight-lane is-you">
                <div class="fight-lane-title">
                  <span class="role-pill is-you">TU</span>
                  <div>
                    <strong>La tua carta</strong>
                    <small>${escapeHtml(selfPlayer.name)}</small>
                  </div>
                </div>
                ${renderChosenCard(selfPlayer, snapshot.selfId)}
              </section>
            `
            : ""
        }
        <section class="fight-lane is-opponents">
          <div class="fight-lane-title">
            <span class="role-pill is-opponent">${escapeHtml(isParticipant ? opponent?.name ?? "Avversario" : "DUELLO")}</span>
            <div>
              <strong>Carte rivelate</strong>
              <small>${escapeHtml(opponents.map((player) => player.name).join(" vs "))}</small>
            </div>
          </div>
          <div class="fighters">
            ${opponents.map((player) => renderChosenCard(player, snapshot.selfId)).join("")}
          </div>
        </section>
      </div>
      ${
        isParticipant && self?.isActive && card
          ? selfPlayer.hasSubmittedPlan
            ? `<p class="notice">Piano confermato. In attesa dell'avversario.</p>`
            : this.renderPlanControls(lobby, card, opponent?.selectedCard)
          : `<div class="waiting"><h2>Lobby duello</h2><p>I player attivi stanno distribuendo attacchi e difese.</p></div>`
      }
    `;
  }

  renderPlanControls(lobby, card, opponentCard) {
    const validation = getPlanValidation(lobby, card);
    const attackPool = getAttackPool(card);
    const defensePool = getDefensePool(card);
    const activeCost = Number(card.active?.cost ?? 0);
    const activeEnabled = canUseActive(card, lobby.self);

    return `
      <section class="plan-controls">
        <div class="plan-grid">
          ${renderPlanDistribution({
            title: "Attacchi",
            kind: "attacks",
            card,
            opponentCard,
            distribution: appState.plan.attacks,
            pool: attackPool,
            slots: lobby.settings?.attackSlots ?? 3
          })}
          ${renderPlanDistribution({
            title: "Difese",
            kind: "defenses",
            card,
            opponentCard,
            distribution: appState.plan.defenses,
            pool: defensePool,
            slots: lobby.settings?.defenseSlots ?? 3
          })}
        </div>
        <div class="mana-line">
          <label class="${activeEnabled ? "switch" : "switch muted"}">
            <input type="checkbox" data-action="toggle-active" ${appState.plan.useActive && activeEnabled ? "checked" : ""} ${activeEnabled ? "" : "disabled"} />
            Usa attiva (${activeCost} mana)
          </label>
          <span>${escapeHtml(card.active?.name ?? "Attiva")}</span>
          <button type="button" data-action="submit-plan" ${validation.ok ? "" : "disabled"}>
            Conferma piano
          </button>
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
      send("sendChat", { text: input.value });
      input.value = "";
    });

    this.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", () => {
        const action = element.dataset.action;
        if (action === "create") send("createLobby");
        if (action === "join-code") send("joinLobby", { lobbyId: element.dataset.lobbyId });
        if (action === "leave") send("leaveLobby");
        if (action === "start") send("startGame");
        if (action === "next-round") send("nextRound");
        if (action === "restart") send("restartLobby");
        if (action === "draft-card" && !element.hasAttribute("disabled")) {
          send("draftCard", { cardId: element.dataset.cardId });
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

    this.querySelector('[data-action="toggle-active"]')?.addEventListener("change", (event) => {
      appState.plan.useActive = event.currentTarget.checked;
      this.render();
    });

    this.querySelectorAll('[data-action="plan-toggle"]').forEach((input) => {
      input.addEventListener("change", (event) => {
        updatePlanStat(input.dataset.planKind, input.dataset.planStat, event.currentTarget.checked);
        this.render();
      });
    });

    this.querySelectorAll('[data-action="plan-points"]').forEach((input) => {
      input.addEventListener("input", (event) => {
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
              <span class="ability-text">${escapeHtml(card.active?.text ?? "")}</span>
            </div>
            <div class="ability-list">
              <span class="ability-name">${escapeHtml(card.passive?.name ?? "Tratto")}</span>
              <span class="ability-text">${escapeHtml(card.passive?.text ?? "")}</span>
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

function renderTopPlayer(player, phase, settings) {
  const status = getPlayerStatus(player, phase);
  const cards = player.deck ?? [];
  const maxHealth = Number(player.maxHealth ?? settings?.maxHealth ?? 50);
  const maxMana = Number(settings?.maxMana ?? 10);
  const healthPct = percent(player.health, maxHealth);
  const manaPct = percent(player.mana, maxMana);
  return `
    <article class="top-player ${player.alive ? "" : "is-out"}">
      <div class="top-player-head">
        <strong>${escapeHtml(player.name)}</strong>
        <small>${player.isHost ? `Host - ${status}` : status}</small>
      </div>
      <div class="top-player-bars">
        <div class="resource-bar is-health" title="PV ${player.health}/${maxHealth}">
          <i style="width: ${healthPct}%"></i>
          <span>PV ${player.health}/${maxHealth}</span>
        </div>
        <div class="resource-bar is-mana" title="Mana ${player.mana}/${maxMana}">
          <i style="width: ${manaPct}%"></i>
          <span>Mana ${player.mana}/${maxMana}</span>
        </div>
      </div>
      <div class="top-player-meta">
        <span>${player.deckCount} carte</span>
        <span>${Object.keys(player.cooldowns ?? {}).length} cd</span>
      </div>
      <div class="top-card-strip">
        ${
          cards.length
            ? cards
                .map(
                  (card) => `
                    <img data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="${escapeAttr(card.name ?? card.id)}" title="${escapeAttr(card.name ?? card.id)}" />
                  `
                )
                .join("")
            : `<i></i>`
        }
      </div>
    </article>
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

function renderDraftCard(item) {
  const card = item.card;
  return `
    <div class="draft-card-wrap">
      <game-card
        data-card-id="${escapeAttr(card.id)}"
        data-action-name="draft-card"
        data-selected="false"
        data-disabled="${item.canPick ? "false" : "true"}"
        class="${item.isAvailable ? "" : "is-taken"}"
      ></game-card>
      <div class="draft-card-meta">
        <span>Costo ${item.cost}</span>
        <span>ATT ${card.combat?.attackPower ?? 0}% (${item.attackPool})</span>
        <span>DIF ${card.combat?.defensePower ?? 0}% (${item.defensePool})</span>
      </div>
      ${item.isAvailable ? (item.canAfford ? "" : `<span class="taken-label">Troppo costosa</span>`) : `<span class="taken-label">Presa da ${escapeHtml(item.takenByName)}</span>`}
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
          <p><strong>${escapeHtml(card.active?.name ?? "Attiva")}</strong> ${escapeHtml(card.active?.text ?? "")}</p>
          <p><strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong> ${escapeHtml(card.passive?.text ?? "")}</p>
        </div>
      </div>
    </article>
  `;
}

function renderPlanDistribution({ title, kind, card, opponentCard, distribution, pool, slots }) {
  const selectedStats = Object.keys(distribution);
  const used = sumDistribution(distribution);
  const remaining = Math.max(0, pool - used);
  const isPoolFull = remaining <= 0;
  return `
    <div class="choice-panel">
      <div class="section-title">
        <h2>${escapeHtml(title)}</h2>
        <span>${selectedStats.length}/${slots} - ${used}/${pool}</span>
      </div>
      <div class="pool-meter ${isPoolFull ? "is-full" : ""}">
        <i style="width: ${percent(used, pool)}%"></i>
        <span>${isPoolFull ? "Pool massimo raggiunto" : `${remaining} punti rimasti`}</span>
      </div>
      <div class="plan-stat-list">
        ${VALERIO_KEYS.map((stat) => {
          const selected = Object.hasOwn(distribution, stat);
          const locked = !selected && (selectedStats.length >= slots || isPoolFull);
          const value = Number(distribution[stat] ?? 0);
          const pointLimit = value + remaining;
          const pointsLocked = !selected || isPoolFull;
          return `
            <label class="plan-stat ${selected ? "is-selected" : ""} ${locked || pointsLocked ? "is-locked" : ""}">
              <input
                type="checkbox"
                data-action="plan-toggle"
                data-plan-kind="${escapeAttr(kind)}"
                data-plan-stat="${escapeAttr(stat)}"
                ${selected ? "checked" : ""}
                ${locked ? "disabled" : ""}
              />
              <span>${stat}</span>
              <strong>${escapeHtml(VALERIO_LABELS[stat])}</strong>
              <small>${Number(getCardValerio(card)[stat] ?? 0)}${opponentCard ? ` vs ${Number(getCardValerio(opponentCard)[stat] ?? 0)}` : ""}</small>
              <input
                type="number"
                min="0"
                max="${pointLimit}"
                value="${value}"
                data-action="plan-points"
                data-plan-kind="${escapeAttr(kind)}"
                data-plan-stat="${escapeAttr(stat)}"
                ${pointsLocked ? "disabled" : ""}
              />
            </label>
          `;
        }).join("")}
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
      <span>${line.attackPoints} + ${line.attackerValerio} - ${line.defenderValerio} - ${line.defensePoints}</span>
      <b>${line.lineDamage}</b>
      ${line.defenseIgnored ? `<em>difesa ignorata</em>` : ""}
    </div>
  `;
}

function renderStats(card, attackKeys = [], defenseKeys = []) {
  const valerio = getCardValerio(card);
  return `
    <div class="stats">
      ${VALERIO_KEYS.map((key) => {
        const hotClass = attackKeys.includes(key) ? "is-hot" : defenseKeys.includes(key) ? "is-cool" : "";
        return `<span class="${hotClass}" title="${escapeAttr(VALERIO_LABELS[key])}">${key}${Number(valerio[key] ?? 0)}</span>`;
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
  return `
    <div class="chat-message ${message.kind === "system" ? "is-system" : ""}">
      <strong>${message.kind === "system" ? "Sistema" : escapeHtml(message.name ?? "Player")}</strong>
      <p>${escapeHtml(message.text)}</p>
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
        <p>${escapeHtml(card.active?.text ?? "")}</p>
      </div>
      <div class="ability-box">
        <span>Tratto - sempre attivo</span>
        <strong>${escapeHtml(card.passive?.name ?? "Tratto")}</strong>
        <p>${escapeHtml(card.passive?.text ?? "")}</p>
      </div>
    </div>
  `;
}

function renderPlanSummary(lobby, self, selectedCard, opponent, opponentCard) {
  if (!self?.isActive || !selectedCard) {
    return `
      <div class="side-summary">
        <p class="eyebrow">Piano</p>
        <h2>Lobby duello</h2>
        <p>Le carte sono rivelate ai partecipanti. Attacchi e difese restano coperti fino al reveal.</p>
      </div>
    `;
  }

  const attackPool = getAttackPool(selectedCard);
  const defensePool = getDefensePool(selectedCard);
  const attacksUsed = sumDistribution(appState.plan.attacks);
  const defensesUsed = sumDistribution(appState.plan.defenses);
  const previewLines = opponentCard
    ? Object.entries(appState.plan.attacks).map(([stat, points]) => {
        const mine = Number(getCardValerio(selectedCard)[stat] ?? 0);
        const enemy = Number(getCardValerio(opponentCard)[stat] ?? 0);
        const raw = Number(points) + mine - enemy;
        return `${stat}: ${points} + ${mine} - ${enemy} = ${Math.max(0, raw)} prima delle difese`;
      })
    : [];

  return `
    <div class="side-summary">
      <p class="eyebrow">Piano</p>
      <h2>${escapeHtml(selectedCard.name)}</h2>
      <div class="summary-line"><span>Attacco</span><strong>${attacksUsed}/${attackPool}</strong></div>
      <div class="summary-line"><span>Difesa</span><strong>${defensesUsed}/${defensePool}</strong></div>
      <div class="summary-line"><span>Mana dopo attiva</span><strong>${appState.plan.useActive ? Math.max(0, self.mana - Number(selectedCard.active?.cost ?? 0)) : self.mana}</strong></div>
      ${opponentCard ? `<div class="summary-line is-compare"><span>Avversario</span><strong>${escapeHtml(opponent?.name ?? "Player")}</strong></div>` : ""}
      ${previewLines.map((line) => `<p class="math-line">${escapeHtml(line)}</p>`).join("")}
      <div class="ability-box">
        <span>Attiva - opzionale</span>
        <strong>${escapeHtml(selectedCard.active?.name ?? "Attiva")}</strong>
        <p>${escapeHtml(selectedCard.active?.text ?? "")}</p>
      </div>
      <div class="ability-box">
        <span>Tratto - sempre attivo</span>
        <strong>${escapeHtml(selectedCard.passive?.name ?? "Tratto")}</strong>
        <p>${escapeHtml(selectedCard.passive?.text ?? "")}</p>
      </div>
    </div>
  `;
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

function updatePlanStat(kind, stat, checked) {
  const distribution = appState.plan[kind];
  if (!distribution || !VALERIO_KEYS.includes(stat)) {
    return;
  }

  if (checked) {
    const maxSlots = kind === "attacks" ? 3 : 3;
    if (!Object.hasOwn(distribution, stat) && Object.keys(distribution).length < maxSlots) {
      distribution[stat] = 0;
    }
  } else {
    delete distribution[stat];
  }
}

function updatePlanPoints(kind, stat, rawValue) {
  const lobby = appState.snapshot?.lobby;
  const card = getCardById(lobby?.self?.selected?.cardId);
  const distribution = appState.plan[kind];
  if (!card || !distribution || !Object.hasOwn(distribution, stat)) {
    return;
  }

  const pool = kind === "attacks" ? getAttackPool(card) : getDefensePool(card);
  const others = Object.entries(distribution)
    .filter(([key]) => key !== stat)
    .reduce((total, [, value]) => total + Number(value ?? 0), 0);
  const value = clamp(Math.floor(Number(rawValue || 0)), 0, Math.max(0, pool - others));
  distribution[stat] = value;
}

function getPlanValidation(lobby, card) {
  const attackCount = Object.keys(appState.plan.attacks).length;
  const defenseCount = Object.keys(appState.plan.defenses).length;
  const attackTotal = sumDistribution(appState.plan.attacks);
  const defenseTotal = sumDistribution(appState.plan.defenses);
  const attackPool = getAttackPool(card);
  const defensePool = getDefensePool(card);

  if (attackCount !== 3) {
    return { ok: false, error: "Scegli esattamente 3 statistiche di attacco." };
  }
  if (defenseCount !== 3) {
    return { ok: false, error: "Scegli esattamente 3 statistiche di difesa." };
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
  return Object.fromEntries(VALERIO_KEYS.slice(0, 3).map((key) => [key, 0]));
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
  return {
    ...extra,
    value: input.value,
    start: input.selectionStart,
    end: input.selectionEnd
  };
}

function getActivePlayers(lobby) {
  return (lobby.activePair ?? []).map((playerId) => lobby.players.find((player) => player.id === playerId)).filter(Boolean);
}

function getPlayerName(lobby, playerId) {
  return lobby.players.find((player) => player.id === playerId)?.name;
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
