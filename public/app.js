const appState = {
  cardsById: new Map(),
  socket: null,
  connected: false,
  selfId: null,
  snapshot: null,
  lastError: "",
  playerName: localStorage.getItem("vtg:name") || "",
  selectedCardId: "",
  useActive: false
};

class GameApp extends HTMLElement {
  connectedCallback() {
    this.loadCards();
    this.connect();
    this.render();
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

    this.innerHTML = `
      <main class="shell">
        <section class="topbar">
          <div>
            <p class="eyebrow">Valerio The Game</p>
            <h1>${lobby ? `Lobby ${escapeHtml(lobby.id)}` : "Lobby"}</h1>
          </div>
          <div class="connection ${appState.connected ? "is-online" : ""}">
            ${appState.connected ? "Online" : "Connessione"}
          </div>
        </section>
        ${appState.lastError ? `<p class="toast">${escapeHtml(appState.lastError)}</p>` : ""}
        ${lobby ? this.renderLobby(lobby, snapshot) : this.renderHome(snapshot)}
      </main>
    `;

    this.bindEvents();
  }

  renderHome(snapshot) {
    const lobbies = snapshot?.lobbies ?? [];
    return `
      <section class="panel home-grid">
        <form class="join-panel" data-action="name">
          <label>
            Nome
            <input name="name" maxlength="18" value="${escapeAttr(appState.playerName)}" placeholder="Player" />
          </label>
          <button type="submit">Salva nome</button>
        </form>
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
        <div>
          <p class="eyebrow">${phaseLabel(lobby.phase)}</p>
          <h2>${escapeHtml(lobby.id)}</h2>
        </div>
        <div class="actions">
          ${isHost && lobby.phase === "lobby" ? `<button type="button" data-action="start">Inizia</button>` : ""}
          ${isHost && lobby.phase === "reveal" ? `<button type="button" data-action="next-round">Prossimo turno</button>` : ""}
          ${isHost && lobby.phase === "ended" ? `<button type="button" data-action="restart">Reset</button>` : ""}
          <button type="button" class="ghost" data-action="leave">Esci</button>
        </div>
      </section>
      <section class="layout">
        <aside class="panel">
          <div class="section-title">
            <h2>Player</h2>
            <span>${lobby.players.length}</span>
          </div>
          <div class="players">
            ${lobby.players.map((player) => renderPlayer(player, lobby.phase)).join("")}
          </div>
        </aside>
        <section class="panel table">
          ${this.renderPhase(lobby, snapshot)}
        </section>
      </section>
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

  renderSelect(lobby) {
    const self = lobby.self;
    const selectedCard = self.deck.find((card) => card.id === appState.selectedCardId) ?? self.deck[0];
    const alreadyPlayed = Boolean(self.selected?.cardId);

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Turno ${lobby.round}</p>
          <h2>Scegli la carta</h2>
        </div>
        <div class="covered-specials">
          <span>?</span><span>?</span><span>?</span>
        </div>
      </div>
      ${
        self.alive
          ? `
            <div class="mana-line">
              <span>Mana ${self.mana}</span>
              <span>${self.deck.length} carte disponibili</span>
              <span class="muted">${alreadyPlayed ? "Carta bloccata" : "SPECIAL coperti"}</span>
              <button type="button" data-action="submit-card" ${selectedCard && !alreadyPlayed ? "" : "disabled"}>
                ${alreadyPlayed ? "Carta scelta" : "Conferma carta"}
              </button>
            </div>
            <div class="hand-section">
              <div class="section-title">
                <h2>Le tue carte</h2>
                <span>${self.deck.length}</span>
              </div>
              <div class="hand">
                ${self.deck.map((card) => renderCardElement(card, [], card.id === selectedCard?.id, alreadyPlayed)).join("")}
              </div>
            </div>
          `
          : `<div class="waiting"><h2>Fuori</h2><p>La partita continua.</p></div>`
      }
    `;
  }

  renderFight(lobby, snapshot) {
    const self = lobby.self;
    const selfPlayer = lobby.players.find((player) => player.id === snapshot.selfId);
    const opponents = lobby.players.filter((player) => player.id !== snapshot.selfId);
    const selectedCard = selfPlayer?.selectedCard ?? getCardById(self.selected?.cardId);
    const activeCost = Number(selectedCard?.active?.cost ?? 0);
    const canUseActive = selectedCard && self.mana >= activeCost;
    const alreadyConfirmed = self.selected?.useActive !== null && self.selected?.useActive !== undefined;

    return `
      <div class="turn-head">
        <div>
          <p class="eyebrow">Fight ${lobby.round}</p>
          <h2>${lobby.specialKeys.map((key) => snapshot.specialLabels[key]).join(" + ")}</h2>
        </div>
        <div class="specials">${lobby.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
      </div>
      <div class="fight-grid">
        <div class="fight-board">
          <section class="fight-lane is-you">
            <div class="fight-lane-title">
              <span class="role-pill is-you">TU</span>
              <div>
                <strong>La tua carta</strong>
                <small>${escapeHtml(selfPlayer?.name ?? "Tu")}</small>
              </div>
            </div>
            ${renderChosenCard(selfPlayer, lobby.specialKeys, snapshot.selfId)}
          </section>
          <section class="fight-lane is-opponents">
            <div class="fight-lane-title">
              <span class="role-pill is-opponent">${opponents.length === 1 ? "AVVERSARIO" : "AVVERSARI"}</span>
              <div>
                <strong>${opponents.length === 1 ? "Carta avversaria" : "Carte avversarie"}</strong>
                <small>${opponents.map((player) => player.name).join(", ")}</small>
              </div>
            </div>
            <div class="fighters">
              ${opponents.map((player) => renderChosenCard(player, lobby.specialKeys, snapshot.selfId)).join("")}
            </div>
          </section>
        </div>
        ${
          selectedCard && self.alive
            ? `
              <aside class="choice-panel">
                <p class="eyebrow">La tua mossa</p>
                <h2>${escapeHtml(selectedCard.name)}</h2>
                <div class="score-preview">
                  <strong>${scoreBase(selectedCard, lobby.specialKeys)}</strong>
                  <span>base</span>
                </div>
                <div class="ability-list">
                  <article class="ability-box">
                    <span>Attiva - ${activeCost} mana</span>
                    <strong>${escapeHtml(selectedCard.active.name)}</strong>
                    <p>${escapeHtml(selectedCard.active.text)}</p>
                  </article>
                  <article class="ability-box">
                    <span>Passiva</span>
                    <strong>${escapeHtml(selectedCard.passive.name)}</strong>
                    <p>${escapeHtml(selectedCard.passive.text)}</p>
                  </article>
                </div>
                <label class="${canUseActive ? "switch" : "switch muted"}">
                  <input type="checkbox" data-action="toggle-active" ${appState.useActive && canUseActive ? "checked" : ""} ${canUseActive && !alreadyConfirmed ? "" : "disabled"} />
                  Usa attiva
                </label>
                <button type="button" data-action="submit-fight" ${alreadyConfirmed ? "disabled" : ""}>
                  ${alreadyConfirmed ? "Fight confermato" : "Conferma fight"}
                </button>
              </aside>
            `
            : `<aside class="choice-panel"><h2>In attesa</h2><p class="empty">Gli altri stanno decidendo.</p></aside>`
        }
      </div>
    `;
  }

  renderResult(lobby, ended) {
    const result = lobby.lastResult;
    const winner = lobby.players.find((player) => player.id === lobby.winnerId);

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
          <h2>${escapeHtml(result.plays.find((play) => play.playerId === result.winnerId)?.playerName ?? "Winner")} vince</h2>
        </div>
        <div class="specials">${result.specialKeys.map((key) => `<span>${key}</span>`).join("")}</div>
      </div>
      ${result.tieBreak ? `<p class="notice">Pari risolto con Luck, poi mana.</p>` : ""}
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

    this.querySelector('[data-action="name"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("name");
      appState.playerName = String(name || "").trim();
      localStorage.setItem("vtg:name", appState.playerName);
      send("setName", { name: appState.playerName });
      this.render();
    });

    this.querySelector('[data-action="join"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const lobbyId = new FormData(event.currentTarget).get("lobbyId");
      send("joinLobby", { lobbyId });
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
        if (action === "select-card" && !element.hasAttribute("disabled")) {
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
  }
}

class GameCard extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ["data-card-id", "data-specials", "data-selected", "data-disabled"];
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
      <button type="button" data-action="select-card" data-card-id="${escapeAttr(card.id)}" ${this.dataset.disabled === "true" ? "disabled" : ""}>
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

function renderCardElement(card, specialKeys, selected, disabled) {
  return `
    <game-card
      data-card-id="${escapeAttr(card.id)}"
      data-specials="${escapeAttr(specialKeys.join(","))}"
      data-selected="${selected ? "true" : "false"}"
      data-disabled="${disabled ? "true" : "false"}"
      class="${selected ? "is-selected" : ""}"
    ></game-card>
  `;
}

function renderChosenCard(player, specialKeys, selfId) {
  const isSelf = player?.id === selfId;
  const roleText = isSelf ? "TU" : "AVVERSARIO";
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
        <p class="eyebrow">${isSelf ? "La tua carta" : "Carta avversaria"} - ${escapeHtml(player.name)}</p>
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
    <article class="result-row ${play.outcome === "win" ? "is-win" : "is-lose"}">
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

  if (phase === "fight") {
    return player.hasFightChoice ? "Fight pronto" : "Decide attiva";
  }

  return "In gioco";
}

function phaseLabel(phase) {
  return {
    lobby: "Codice",
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
