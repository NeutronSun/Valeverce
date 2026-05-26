# UI Component Map

## App Shell

`src/client/components/GameApp/GameApp.jsx`

Owns:

- Socket hook usage.
- Route sync.
- Current lobby phase switch.
- ESC menu.
- Match header.
- Global selected card state.
- Fight plan local state.

Do not put card, dock, rail, or right panel styling here.

## Phase Views

`src/client/components/PhaseViews/PhaseViews.jsx`

Owns phase screens:

- Home
- Lobby
- Draft
- Select card
- Plan fight
- Reveal

This file is still intentionally grouped. If it grows again, split by phase into:

```txt
PhaseViews/
  HomeView.jsx
  LobbyView.jsx
  DraftView.jsx
  SelectView.jsx
  PlanFightView.jsx
  RevealView.jsx
```

Keep `PhaseViews.module.css` until splitting is actually useful.

## Cards

`src/client/components/Card/Card.jsx`

Owns:

- Card image.
- Draft cost bubble.
- Rarity border.
- Hover overlay.
- ATT/DIF badges.
- Taken/cooldown/selected visual state.
- Active/passive ability box.

Do not style cards from draft/fight/right panel modules except through parent layout size.

## VALERIO Stats

`src/client/components/ValerioStats/ValerioStats.jsx`

Owns:

- V A L E R I O stat bubbles.
- Stat colors.
- Active/passive highlight state.

Use this component instead of rebuilding stat bubbles inside other components.

## Action Dock

`src/client/components/ActionDock/ActionDock.jsx`

Owns:

- Bottom dock.
- Selected card thumbnail.
- VALERIO dock stats.
- PV/mana bars through `ResourceBar`.
- Active/passive buttons.
- Main CTA.

The dock should be constrained to the central area and not cover sidebars.

## Player Rail

`src/client/components/PlayerRail/PlayerRail.jsx`

Owns:

- Left player list.
- Player deck previews.
- Left deck panel.
- Draft rarity legend.
- `ResourceBar`.

`ResourceBar` is shared by dock and right panel. It uses `--bar-ratio`.

## Right Panel

`src/client/components/RightPanel/RightPanel.jsx`

Owns:

- Opponent HUD.
- Inspected card detail.
- Card active/passive detail.
- Preview breach lines.

Do not place action buttons here.

## Chat

`src/client/components/ChatFloat/ChatFloat.jsx`

Owns:

- Floating chat.
- `T` open/focus behavior.
- `Esc` close behavior when focused.
- Drag position through `--chat-x` and `--chat-y`.
- Chat colors:
  - system: gold
  - self: green
  - enemy: red
