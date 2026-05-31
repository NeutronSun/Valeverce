export interface GameAction<TPayload = unknown> {
  readonly type: string;
  readonly playerId: string | null;
  readonly payload: TPayload;
}
