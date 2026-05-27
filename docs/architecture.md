# Architecture Target

## Goal

Move from a server/game monolith to a composable architecture:

- `GameMode` chooses rules + systems.
- `GameEngine` dispatches actions to the current phase/system.
- `GamePhase` / systems handle draft, selection, fight, turn-based flows.
- Server handles socket, lobby, timer, broadcast, serialization.
- Game rules are data/configuration, not hardcoded values spread through code.

## Target modules

```txt
src/
  game/
    valerio/
    rules/
    core/
    modes/
    systems/
      draft/
      selection/
      fight/
    cards/
    utils/

  server/
    socket/
    lobby/
    timer/
    chat/
```

## Rule

The server should not know how fight/draft works.
It should receive socket events, map to GameAction, dispatch to GameEngine, serialize, broadcast.
