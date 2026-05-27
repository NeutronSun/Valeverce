# Refactor Milestones

## Step 1 - Contracts and constants

- `shared/events.ts`
- `game/valerio/Valerio.ts`
- keep `game.js` compatible

## Step 2 - Rules

- `GameRules.ts`
- `defaultRules.ts`
- `createRules.ts`
- compatible `SETTINGS`

## Step 3 - Mechanical server extraction

- `ClientSession.ts`
- `TimerController.ts`
- `CardRepository.ts`
- `ChatService.ts`

## Step 4 - Serializer

- `LobbySerializer.ts`
- preserve state shape

## Step 5 - Engine skeleton

- `GameEngine.ts`
- `GameMode.ts`
- `GamePhase.ts`
- `ClassicMode.ts`

## Step 6 - Draft system

- `StandardDraftSystem.ts`

## Step 7 - Selection system

- `BlindSelectionSystem.ts`

## Step 8 - Classic fight system

- `ClassicFightSystem.ts`

## Step 9 - Turn based skeleton

- `TurnBasedMode.ts`
- `TurnBasedFightSystem.ts`
