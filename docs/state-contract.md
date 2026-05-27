# State Contract

Do not break this serialized state shape without explicitly updating the frontend.

```ts
type ServerStatePayload = {
  type: "state";
  selfId: string;
  settings: LegacySettings;
  valerioLabels: Record<string, string>;
  onlinePlayers: number;
  lobbies: SerializedLobbyListItem[];
  lobby: SerializedLobby | null;
};
```

```ts
type SerializedLobby = {
  id: string;
  hostId: string;
  phase: "lobby" | "draft" | "select" | "plan" | "reveal" | "ended";
  round: number;
  activePair: string[];
  deadlineAt: number | null;
  draft: SerializedDraft | null;
  chat: ChatMessage[];
  lastResult: RoundResult | null;
  winnerId: string | null;
  players: SerializedPlayer[];
  self: SerializedSelf | null;
};
```

Compatibility checklist:
- `snapshot.settings` remains present.
- `snapshot.valerioLabels` remains present.
- `lobby.phase` remains present.
- `lobby.players` remains an array.
- `lobby.self` remains present.
- `lobby.draft.pool` remains compatible.
- `lobby.lastResult` remains compatible.
