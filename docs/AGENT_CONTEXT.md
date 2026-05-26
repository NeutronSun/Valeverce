# VALEVERCE Agent Context

## Stack

- Next.js + React in JavaScript.
- Custom Node server in `src/server.js`.
- Socket.IO for lobby/game events.
- Game rules and pure helpers in `src/game.js`.
- Shared client helpers in `src/client/ui.js`.
- Cards data in `public/data/cards.json`.

## Current UI Architecture

All active React components live in `src/client/components`.

Each component folder should contain only:

```txt
ComponentName/
  ComponentName.jsx
  ComponentName.module.css
```

Do not add `index.js` entrypoints. Import the component file directly.

Example:

```js
import { GameCard } from "../Card/Card.jsx";
```

## Migrated Components

- `GameApp/GameApp.jsx`
- `PhaseViews/PhaseViews.jsx`
- `ActionDock/ActionDock.jsx`
- `RightPanel/RightPanel.jsx`
- `PlayerRail/PlayerRail.jsx`
- `Card/Card.jsx`
- `ValerioStats/ValerioStats.jsx`
- `ChatFloat/ChatFloat.jsx`

## Important Commands

```bash
npm run check
npm run build
npm run validate:cards
npm run smoke
```

Known note: `validate:cards` can fail if card JSON balance/cost values are intentionally out of sync while editing data.

## Server Restart

The app uses a custom server:

```bash
npm run dev
```

Server-side changes need a restart. Next client changes are not guaranteed to hot reload through the custom server in every local setup.
