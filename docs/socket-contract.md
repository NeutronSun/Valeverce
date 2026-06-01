# Socket Contract

## Public client events

- `setName`
- `createLobby`
- `joinLobby`
- `leaveLobby`
- `updateLobbySettings`
- `startGame`
- `draftCard`
- `selectUtilityDeck`
- `selectCard`
- `submitPlan`
- `playEffectCard`
- `passEffectWindow`
- `nextRound`
- `restartLobby`
- `sendChat`
- `latencyProbe`

## Public server events

- `hello`
- `state`
- `error`
- `lobbyList`

Do not rename public events.

Internal mapping is allowed:

```txt
draftCard -> draft.pick-card
selectUtilityDeck -> utility.select-deck
selectCard -> selection.choose-card
submitPlan -> fight.submit-plan
playEffectCard -> effects.play-card
passEffectWindow -> effects.pass
nextRound -> fight.next-round
```
