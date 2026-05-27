# Socket Contract

## Public client events

- `setName`
- `createLobby`
- `joinLobby`
- `leaveLobby`
- `updateLobbySettings`
- `startGame`
- `draftCard`
- `selectCard`
- `submitPlan`
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
selectCard -> selection.choose-card
submitPlan -> fight.submit-plan
nextRound -> fight.next-round
```
