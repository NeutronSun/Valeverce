# Game UI Flow

## Phases

The server phase controls which screen is shown.

- `lobby`: players wait and host can start.
- `draft`: players draft cards with budget.
- `select`: active duelists choose a covered card.
- `plan`: selected cards are revealed, players assign attack/defense points.
- `reveal`: round result and breach calculation.
- `ended`: game over.

## Draft

Main files:

- `PhaseViews/PhaseViews.jsx`
- `Card/Card.jsx`
- `RightPanel/RightPanel.jsx`
- `ActionDock/ActionDock.jsx`

Draft should show:

- Search.
- Sort mode.
- Rarity grouping.
- Card grid.
- Selected card detail on the right.
- Draft CTA in dock.

Card click should only preview/select the card for the dock/right panel. The actual draft action is the dock CTA.

## Select

Main files:

- `PhaseViews/PhaseViews.jsx`
- `ActionDock/ActionDock.jsx`
- `PlayerRail/PlayerRail.jsx`

Select should show the player deck and disabled cooldown cards.

The actual select action is the dock CTA.

## Plan Fight

Main files:

- `PhaseViews/PhaseViews.jsx`
- `ActionDock/ActionDock.jsx`
- `RightPanel/RightPanel.jsx`

Rules:

- Player can assign points to 1-3 attack stats.
- Player can assign points to 1-3 defense stats.
- At least one attack point and one defense point are required.
- Do not exceed attack/defense pools.
- Opponent plan stays hidden until reveal.

The dock owns:

- active toggle
- passive status
- final confirm CTA
- own PV/mana
- selected own card summary

The right panel owns:

- opponent card
- opponent PV/mana
- predicted/preview info

## Reveal

Main files:

- `PhaseViews/PhaseViews.jsx`
- `src/game.js`

Reveal should explain:

- who won
- breach values
- normal damage cap
- active extra damage
- final PV damage
- PV/mana before and after
- each attack line formula

Do not hide the math. The goal is to explain why the round was won or lost.
