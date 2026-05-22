const appState = {
  cardsById: new Map(),
  socket: null,
  connected: false,
  selfId: null,
  snapshot: null,
  lastError: "",
  playerName: localStorage.getItem("vtg:name") || "",
  selectedCardId: "",
  useActive: false,
  handOrder: [],
  draggedCardId: "",
  justDraggedUntil: 0
};

class GameApp extends HTMLElement {
  connectedCallback() {
    this.clock = window.setInterval(() => this.updateTimers(), 2500000);
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
      appState.useActive = false;
      return;
    }

    if (lobby.phase === "select") {
      syncHandOrder(hand);
      if (!hand.some((card) => card.id === appState.selectedCardId)) {
        appState.selectedCardId = hand[0]?.id ?? "";
      }
      appState.useActive = false;
      return;
    }

    if (lobby.phase === "fight") {
      const selectedCardId = lobby.self?.selected?.cardId;
      if (selectedCardId) {
        appState.selectedCardId = selectedCardId;
      }

      const selectedCard = getCardById(selectedCardId);
      const activeCost = Number(selectedCard?.active?.cost ?? 0);
      if (!selectedCard || lobby.self.mana < activeCost) {
        appState.useActive = false;
      }
      return;
    }

    appState.useActive = false;
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
      return {
        kind: "name",
        value: active.value,
        start: active.selectionStart,
        end: active.selectionEnd
      };
    }

    if (active?.closest?.('[data-action="chat"]')) {
      return {
        kind: "chat",
        value: active.value,
        start: active.selectionStart,
        end: active.selectionEnd
      };
    }

    return null;
  }

  restoreFocusState(focusState) {
    if (!focusState) {
      return;
    }

    const input =
      focusState.kind === "name"
        ? this.querySelector('[data-action="name-input"]')
        : this.querySelector('[data-action="chat"] input');

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
            ${lobby.players.map((player) => renderTopPlayer(player, lobby.phase)).join("")}
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
      lobby.phase === "select"
        ? getCardById(appState.selectedCardId)
        : getCardById(self?.selected?.cardId) ?? activePlayers.find((player) => player.id === snapshot.selfId)?.selectedCard;
    const opponentCard = opponent?.selectedCard;

    if (lobby.phase === "draft") {
      return `
        <div class="side-summary">
          <p class="eyebrow">Draft</p>
          <h2>${self?.isCurrentDrafter ? "Tocca a te" : "In attesa"}</h2>
          <p>${escapeHtml(getPlayerName(lobby, lobby.draft?.currentPlayerId) ?? "Player")} sta scegliendo una carta.</p>
          <div class="summary-line"><span>Le tue carte</span><strong>${self?.deck.length ?? 0}/${lobby.draft?.target ?? 6}</strong></div>
          <div class="summary-line"><span>Pool rimasto</span><strong>${(lobby.draft?.pool ?? []).filter((item) => item.isAvailable).length}</strong></div>
        </div>
      `;
    }

    if (lobby.phase === "select") {
      return `
        <div class="side-summary">
          <p class="eyebrow">SPECIAL round</p>
          <div class="specials">${lobby.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
          <h2>${self?.isActive ? "Scegli la carta" : "Sei spettatore"}</h2>
          ${selectedCard ? renderCardMath(selectedCard, lobby.specialKeys, "La tua preview") : `<p class="empty">Seleziona una carta per vedere il calcolo base.</p>`}
        </div>
      `;
    }

    if (lobby.phase === "fight") {
      return `
        <div class="side-summary">
          <p class="eyebrow">${self?.isActive ? "La tua mossa" : "Duello in corso"}</p>
          ${selectedCard ? renderFightMath(selectedCard, opponentCard, lobby, self, appState.useActive) : `<p class="empty">Stai guardando il fight.</p>`}
          ${
            selectedCard && self?.isActive
              ? `
                <label class="${canUseActive(selectedCard, self) ? "switch" : "switch muted"}">
                  <input type="checkbox" data-action="toggle-active" ${appState.useActive && canUseActive(selectedCard, self) ? "checked" : ""} ${canUseActive(selectedCard, self) && self.selected?.useActive === null ? "" : "disabled"} />
                  Usa attiva
                </label>
                <button type="button" data-action="submit-fight" ${self.selected?.useActive !== null ? "disabled" : ""}>
                  ${self.selected?.useActive !== null ? "Fight confermato" : "Conferma fight"}
                </button>
              `
              : ""
          }
        </div>
      `;
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

    if (lobby.phase === "fight") {
      return this.renderFight(lobby, snapshot);
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
      <div class="draft-picked">
        <strong>Le tue carte draftate</strong>
        <div>${(self?.deck ?? []).map((card) => `<span>${escapeHtml(card.name)}</span>`).join("") || "<span>Nessuna</span>"}</div>
      </div>
      <div class="draft-pool">
        ${(lobby.draft?.pool ?? [])
          .map((item) => renderDraftCard(item, isMyTurn && item.isAvailable && (self?.deck.length ?? 0) < (lobby.draft?.target ?? 6)))
          .join("")}
      </div>
    `;
  }

  renderSelect(lobby) {
    const self = lobby.self;
    const orderedDeck = orderCards(self.deck);
    const selectedCard = orderedDeck.find((card) => card.id === appState.selectedCardId) ?? orderedDeck[0];
    const alreadyPlayed = Boolean(self.selected?.cardId);
    const activePlayers = getActivePlayers(lobby);
    const pairLabel = activePlayers.map((player) => player.name).join(" vs ");

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Duello ${lobby.round}</p>
          <h2>${escapeHtml(pairLabel)}</h2>
        </div>
        <div class="turn-tools">
          ${renderTimer(lobby)}
          <div class="specials">${lobby.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
        </div>
      </div>
      ${
        self.alive && self.isActive
          ? `
            <div class="mana-line">
              <span>Mana ${self.mana}</span>
              <span>${self.deck.length} carte disponibili</span>
              <span class="muted">${alreadyPlayed ? "Carta bloccata" : "SPECIAL visibili"}</span>
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
                ${orderedDeck.map((card) => renderCardElement(card, [], card.id === selectedCard?.id, alreadyPlayed, !alreadyPlayed)).join("")}
              </div>
            </div>
          `
          : `<div class="waiting"><h2>Stai guardando</h2><p>${escapeHtml(pairLabel)} stanno scegliendo la carta.</p></div>`
      }
    `;
  }

  renderFight(lobby, snapshot) {
    const self = lobby.self;
    const activePlayers = getActivePlayers(lobby);
    const selfPlayer = activePlayers.find((player) => player.id === snapshot.selfId);
    const opponents = activePlayers.filter((player) => player.id !== snapshot.selfId);
    const isParticipant = Boolean(selfPlayer);
    const opponentNames = opponents.map((player) => player.name).join(" vs ");

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Fight ${lobby.round}</p>
          <h2>${lobby.specialKeys.map((key) => snapshot.specialLabels[key]).join(" + ")}</h2>
        </div>
        <div class="specials">${lobby.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
      </div>
      <div class="fight-board ${isParticipant ? "" : "is-spectator"}">
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
                ${renderChosenCard(selfPlayer, lobby.specialKeys, snapshot.selfId)}
              </section>
            `
            : ""
        }
        <section class="fight-lane is-opponents">
          <div class="fight-lane-title">
            <span class="role-pill is-opponent">${escapeHtml(isParticipant ? opponentNames : "DUELLO")}</span>
            <div>
              <strong>${isParticipant ? "Carta in campo" : "Carte in campo"}</strong>
              <small>${escapeHtml(opponentNames)}</small>
            </div>
          </div>
          <div class="fighters">
            ${opponents.map((player) => renderChosenCard(player, lobby.specialKeys, snapshot.selfId)).join("")}
          </div>
        </section>
      </div>
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
        <div class="specials">${result.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
      </div>
      ${result.tieBreak ? `<p class="notice">Pareggio: nessuno perde carte, prossimo round.</p>` : ""}
      <div class="result-list">
        ${result.plays.map((play) => renderResultRow(play, result.specialKeys)).join("")}
      </div>
      ${
        ended && winner
          ? `<div class="winner-banner">${escapeHtml(winner.name)} resta con ${winner.deckCount} carte.</div>`
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
          appState.useActive = false;
          this.render();
        }
        if (action === "submit-card") {
          send("selectCard", { cardId: appState.selectedCardId });
        }
        if (action === "submit-fight") {
          send("submitFight", { useActive: appState.useActive });
        }
      });
    });

    this.querySelector('[data-action="toggle-active"]')?.addEventListener("change", (event) => {
      appState.useActive = event.currentTarget.checked;
      this.render();
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
    return ["data-card-id", "data-action-name", "data-specials", "data-selected", "data-disabled"];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const card = getCardById(this.dataset.cardId);
    if (!card) {
      return;
    }

    const specials = (this.dataset.specials || "").split(",").filter(Boolean);
    const initials = getInitials(card.name);

    this.innerHTML = `
      <button type="button" data-action="${escapeAttr(this.dataset.actionName || "select-card")}" data-card-id="${escapeAttr(card.id)}" ${this.dataset.disabled === "true" ? "disabled" : ""}>
        <div class="card-image-fallback">
          <span>${escapeHtml(initials)}</span>
        </div>
        <img class="card-full-image" data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
        <div class="card-body card-overlay">
          <strong>${escapeHtml(card.name)}</strong>
          <small>${escapeHtml(card.id)}</small>
          ${renderStats(card, specials)}
          <div class="abilities">
            <div class="ability-list">
              <span class="ability-name">${escapeHtml(card.active.name)}</span>
              <span class="ability-text">${escapeHtml(card.active.text)}</span>
            </div>
            <div class="ability-list">
              <span class="ability-name">${escapeHtml(card.passive.name)}</span>
              <span class="ability-text">${escapeHtml(card.passive.text)}</span>
            </div>
          </div>
        </div>
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

function renderPlayer(player, phase) {
  const status = getPlayerStatus(player, phase);
  return `
    <article class="player ${player.alive ? "" : "is-out"}">
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${player.isHost ? `Host - ${status}` : status}</small>
      </div>
      <div>
        <span>${player.mana} mana</span>
        <span>${player.deckCount} carte</span>
      </div>
    </article>
  `;
}

function renderTopPlayer(player, phase) {
  const status = getPlayerStatus(player, phase);
  const cards = player.deck ?? [];
  return `
    <article class="top-player ${player.alive ? "" : "is-out"}">
      <strong>${escapeHtml(player.name)}</strong>
      <span>${player.mana}M</span>
      <span>${player.deckCount}C</span>
      <small>${player.isHost ? `Host - ${status}` : status}</small>
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

function renderCardElement(card, specialKeys, selected, disabled, draggable = false) {
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
        data-specials="${escapeAttr(specialKeys.join(","))}"
        data-selected="${selected ? "true" : "false"}"
        data-disabled="${disabled ? "true" : "false"}"
        class="${selected ? "is-selected" : ""}"
      ></game-card>
    </div>
  `;
}

function renderDraftCard(item, canPick) {
  const card = item.card;
  return `
    <div class="draft-card-wrap">
      <game-card
        data-card-id="${escapeAttr(card.id)}"
        data-action-name="draft-card"
        data-specials=""
        data-selected="false"
        data-disabled="${canPick ? "false" : "true"}"
        class="${item.isAvailable ? "" : "is-taken"}"
      ></game-card>
      ${item.isAvailable ? "" : `<span class="taken-label">Presa da ${escapeHtml(item.takenByName)}</span>`}
    </div>
  `;
}

function renderChosenCard(player, specialKeys, selfId) {
  const isSelf = player?.id === selfId;
  const roleText = isSelf ? "TU" : player?.name ?? "Player";
  const card = player?.selectedCard;

  if (!card) {
    return `
      <article class="fight-card ${isSelf ? "is-self" : "is-opponent"} is-empty">
        <span class="fight-role-tag ${isSelf ? "is-you" : "is-opponent"}">${roleText}</span>
        <strong>${escapeHtml(player?.name ?? "Player")}</strong>
        <p>${player?.alive ? "Carta coperta" : "Fuori"}</p>
      </article>
    `;
  }

  return `
    <article class="fight-card ${isSelf ? "is-self" : "is-opponent"}">
      <span class="fight-role-tag ${isSelf ? "is-you" : "is-opponent"}">${roleText}</span>
      <div class="card-image-fallback">
        <span>${escapeHtml(getInitials(card.name))}</span>
      </div>
      <img class="card-full-image" data-card-image src="${escapeAttr(cardImageSrc(card))}" alt="" />
      <div class="fight-body card-overlay">
        <p class="eyebrow">${isSelf ? "La tua carta" : `Carta di ${escapeHtml(player.name)}`}</p>
        <h3>${escapeHtml(card.name)}</h3>
        ${renderStats(card, specialKeys)}
        <div class="mini-abilities">
          <p><strong>${escapeHtml(card.active.name)}</strong> ${escapeHtml(card.active.text)}</p>
          <p><strong>${escapeHtml(card.passive.name)}</strong> ${escapeHtml(card.passive.text)}</p>
        </div>
      </div>
    </article>
  `;
}

function renderResultRow(play, specialKeys) {
  return `
    <article class="result-row ${play.outcome === "win" ? "is-win" : play.outcome === "tie" ? "is-tie" : "is-lose"}">
      <div class="result-card-art">
        <span>${escapeHtml(getInitials(play.cardName))}</span>
        ${play.card ? `<img data-card-image src="${escapeAttr(cardImageSrc(play.card))}" alt="" />` : ""}
      </div>
      <div>
        <strong>${escapeHtml(play.playerName)}</strong>
        <small>${escapeHtml(play.cardName)}${play.eliminated ? " - eliminato" : ""}</small>
        ${play.card ? renderStats(play.card, specialKeys) : ""}
      </div>
      <div class="result-score">${play.score}</div>
      <p>${play.notes.map(escapeHtml).join(" / ")}${play.useActive ? " / Attiva usata" : " / Attiva non usata"}</p>
    </article>
  `;
}

function renderStats(card, specialKeys) {
  return `
    <div class="stats">
      ${Object.entries(card.special)
        .map(([key, value]) => `<span class="${specialKeys.includes(key) ? "is-hot" : ""}">${value}</span>`)
        .join("")}
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

function renderChatMessage(message) {
  return `
    <div class="chat-message ${message.kind === "system" ? "is-system" : ""}">
      <strong>${message.kind === "system" ? "Sistema" : escapeHtml(message.name ?? "Player")}</strong>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `;
}

function renderCardMath(card, specialKeys, title) {
  return `
    <div class="math-box">
      <h3>${escapeHtml(title)}</h3>
      <strong>${escapeHtml(card.name)}</strong>
      <div class="summary-line"><span>Base SPECIAL</span><strong>${scoreBase(card, specialKeys)}</strong></div>
      ${specialKeys
        .map((key) => `<div class="summary-line"><span>${key}</span><strong>${Number(card.special[key] ?? 0)}</strong></div>`)
        .join("")}
      <div class="ability-box">
        <span>Attiva - ${Number(card.active.cost ?? 0)} mana</span>
        <strong>${escapeHtml(card.active.name)}</strong>
        <p>${escapeHtml(card.active.text)}</p>
      </div>
      <div class="ability-box">
        <span>Passiva - solo con attiva</span>
        <strong>${escapeHtml(card.passive.name)}</strong>
        <p>${escapeHtml(card.passive.text)}</p>
      </div>
    </div>
  `;
}

function renderFightMath(card, opponentCard, lobby, self, useActive) {
  const preview = scorePreview(card, lobby.specialKeys, useActive, self.mana, self.deck.length);
  const opponentBase = opponentCard ? scoreBase(opponentCard, lobby.specialKeys) : null;
  return `
    <h2>${escapeHtml(card.name)}</h2>
    <div class="score-preview">
      <strong>${preview.score}</strong>
      <span>${useActive ? "con attiva" : "senza attiva"}</span>
    </div>
    <div class="summary-line"><span>Base</span><strong>${preview.baseScore}</strong></div>
    <div class="summary-line"><span>Attiva</span><strong>${formatSigned(preview.activeScore)}</strong></div>
    <div class="summary-line"><span>Passiva ${useActive ? "" : "(spenta)"}</span><strong>${formatSigned(preview.passiveScore)}</strong></div>
    <div class="summary-line"><span>Mana dopo scelta</span><strong>${Math.max(0, self.mana - preview.manaCost)}</strong></div>
    ${
      opponentCard
        ? `<div class="summary-line is-compare"><span>Avversario base</span><strong>${opponentBase}</strong></div>
           <p class="notice">${preview.score >= opponentBase ? "Se l'avversario non usa bonus, sei sopra o pari." : "Senza bonus extra sei sotto la base avversaria."}</p>`
        : ""
    }
    <div class="ability-box">
      <span>Attiva - ${Number(card.active.cost ?? 0)} mana</span>
      <strong>${escapeHtml(card.active.name)}</strong>
      <p>${escapeHtml(card.active.text)}</p>
    </div>
    <div class="ability-box">
      <span>Passiva - solo con attiva</span>
      <strong>${escapeHtml(card.passive.name)}</strong>
      <p>${escapeHtml(card.passive.text)}</p>
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
      ${(result.summary?.lines ?? []).map((line) => `<p class="math-line">${escapeHtml(line.text)}</p>`).join("")}
      ${
        selfPlay && opponentPlay
          ? `
            <div class="summary-line"><span>Tu</span><strong>${selfPlay.score}</strong></div>
            <div class="summary-line"><span>Avversario</span><strong>${opponentPlay.score}</strong></div>
            <div class="summary-line"><span>Mana speso</span><strong>${selfPlay.manaCost}</strong></div>
            <div class="summary-line"><span>Mana round</span><strong>+${selfPlay.manaStartGain} / +${selfPlay.manaOutcomeGain}</strong></div>
          `
          : ""
      }
    </div>
  `;
}

function scorePreview(card, specialKeys, useActive, mana, deckSize) {
  const selectedStats = specialKeys.map((key) => Number(card.special[key] ?? 0));
  const baseScore = selectedStats.reduce((total, value) => total + value, 0);
  let activeScore = 0;
  let passiveScore = 0;
  let manaCost = 0;

  if (useActive && mana >= Number(card.active?.cost ?? 0)) {
    manaCost = Number(card.active.cost ?? 0);
    activeScore = resolveEffect(card.active.effect, { card, specialKeys, selectedStats, mana, deckSize });
    passiveScore = resolveEffect(card.passive.effect, { card, specialKeys, selectedStats, mana, deckSize });
  }

  return {
    score: baseScore + activeScore + passiveScore,
    baseScore,
    activeScore,
    passiveScore,
    manaCost
  };
}

function resolveEffect(effect, context) {
  if (!effect) return 0;
  if (effect.type === "score") return Number(effect.value ?? 0);
  if (effect.type === "selected-stat") return context.specialKeys.includes(effect.stat) ? Number(context.card.special[effect.stat] ?? 0) : 0;
  if (effect.type === "highest-selected") return Math.max(...context.selectedStats);
  if (effect.type === "lowest-selected") return Math.min(...context.selectedStats);
  if (effect.type === "contains") return context.specialKeys.includes(effect.stat) ? Number(effect.value ?? 0) : 0;
  if (effect.type === "missing") return context.specialKeys.includes(effect.stat) ? 0 : Number(effect.value ?? 0);
  if (effect.type === "deck-low") return context.deckSize <= Number(effect.count ?? 0) ? Number(effect.value ?? 0) : 0;
  if (effect.type === "mana-low") return context.mana <= Number(effect.mana ?? 0) ? Number(effect.value ?? 0) : 0;
  return 0;
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

function formatSigned(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function readCards(data) {
  return Array.isArray(data) ? data : data.cards ?? [];
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

  if (phase === "fight") {
    return player.hasFightChoice ? "Fight pronto" : "Decide attiva";
  }

  return "In gioco";
}

function phaseLabel(phase) {
  return {
    lobby: "Codice",
    draft: "Draft",
    select: "Scelta carta",
    fight: "Fight",
    reveal: "Risultato",
    ended: "Fine"
  }[phase] ?? "Codice";
}

function scoreBase(card, specialKeys) {
  return specialKeys.reduce((total, key) => total + Number(card.special[key] ?? 0), 0);
}

function getCardById(cardId) {
  return cardId ? appState.cardsById.get(cardId) : null;
}

function cardImageSrc(card) {
  return `/cards/${encodeURIComponent(card.id)}.png`;
}

function getInitials(name) {
  return name
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
