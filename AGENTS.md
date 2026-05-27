# Valerio The Game - Codex Instructions

## Non negoziabile

- Non cambiare il comportamento attuale del gioco classico.
- Non cambiare gli eventi socket pubblici.
- Non cambiare lo shape dello state inviato al frontend.
- Non cambiare `cards.json`.
- Non introdurre dipendenze inutili.
- Non creare mega `Utils`.
- Non lasciare funzioni sparse nei file principali.
- Mantieni `src/game.js` compatibile come barrel/export temporaneo.
- Il client legacy WebSocket non va modificato se non è l'entrypoint reale.

## Architettura target

- `GameMode` compone `rules + systems`.
- `GameEngine` esegue le action e delega alla fase corrente.
- `GamePhase/GameSystem` contiene draft, selection, fight.
- Il server gestisce socket, lobby, timer, broadcast.
- La logica di gioco non deve stare nel socket layer.
- Le modalità nuove devono essere classi che compongono sistemi e regole, non `if (mode === "...")` sparsi.

## TypeScript obbligatorio per contratti

Devono essere TypeScript:

- eventi client/server
- payload socket
- GameAction
- GameState
- PlayerState
- Card / Ability / Effect
- GameRules
- GameMode / GamePhase / GameEngine
- LobbyState / LobbySerializer
- SocketGateway
- CardRepository
- costanti VALERIO
- costanti phase/status

## Stile codice personale

- Fix mirati, no refactor ampi non richiesti.
- File completi quando richiesto.
- Codice autoesplicativo.
- Nessuna libreria inutile.
- Vanilla JS/Web Components: no `#private fields`.
- Preferire `async/await`, evitare catene `.then()` non necessarie.
- Preferire `for...of` quando migliora leggibilità.
- Magic numbers in costanti statiche/contestuali.
- CSS-first, preferire attributi/stati chiari.
- JavaScript/TypeScript: classi con responsabilità singola.
- No funzioni globali sparse nei file principali.
- No `helpers.js` o `Utils` gigante.
- Se serve una utility, deve essere contestuale:
  - `CardTooltipUtils`
  - `FightPreviewUtils`
  - `EffectResolver`
  - `DraftUtils`
  - `LobbySerializer`

## Workflow professionale

- Un solo writer: il main agent.
- I subagent sono read-only validator/reviewer/tester, salvo richiesta esplicita.
- Lavora a step piccoli.
- Ogni step deve passare:
  - typecheck
  - lint se presente
  - test se presenti
  - build
  - compatibility checklist
  - style validator

Se un controllo fallisce, fermati e correggi solo il blocker.
