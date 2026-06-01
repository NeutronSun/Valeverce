import type { Card as DomainCard } from "../../game/cards/CardTypes";
import type { ChatMessage, GamePhase, ServerEventPayloads, ValerioKey } from "../../shared/types";

type LobbyMap = Map<string, SerializedLobbyState>;
type ClientMap = Map<string, ClientState>;

export type LobbySerializerSettings = {
  readonly maxHealth: number;
  readonly maxPlayers: number;
  readonly draftBudget: number;
};

export type ClientState = {
  readonly id: string;
};

export type DraftState = {
  readonly target: number;
  readonly taken: string[];
  readonly pool: string[];
};

export type SelectedPlanState = {
  readonly cardId?: string;
  readonly attacks?: Partial<Record<ValerioKey, number>> | null;
  readonly defenses?: Partial<Record<ValerioKey, number>> | null;
  readonly useActive?: boolean | null;
};

export type PlayerState = {
  readonly id: string;
  readonly name: string;
  readonly health: number;
  readonly mana: number;
  readonly deck: string[];
  readonly draftSpent: number;
  readonly cooldowns: Record<string, number>;
  readonly alive: boolean;
  readonly selected: SelectedPlanState | null;
};

export type SerializedLobbyState = {
  readonly id: string;
  readonly hostId: string;
  readonly phase: GamePhase;
  readonly round: number;
  readonly activePair: string[];
  readonly deadlineAt: number | null;
  readonly draft: DraftState | null;
  readonly chat: ChatMessage[];
  readonly lastResult: unknown;
  readonly winnerId: string | null;
  readonly players: Map<string, PlayerState>;
};

export type SerializedSelectedPlanPayload = {
  readonly cardId: string;
  readonly attacks: Partial<Record<ValerioKey, number>> | null;
  readonly defenses: Partial<Record<ValerioKey, number>> | null;
  readonly useActive: boolean | null;
  readonly attackPool: number;
  readonly defensePool: number;
};

export type SerializedPlayerPayload = {
  readonly id: string;
  readonly name: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly mana: number;
  readonly deck: DomainCard[];
  readonly deckCount: number;
  readonly draftCount: number;
  readonly draftSpent: number;
  readonly draftBudget: number;
  readonly draftBudgetRemaining: number;
  readonly cooldowns: Record<string, number>;
  readonly alive: boolean;
  readonly isActive: boolean;
  readonly isCurrentDrafter: boolean;
  readonly hasSelected: boolean;
  readonly hasSubmittedPlan: boolean;
  readonly selectedCard: DomainCard | null;
  readonly selected: SerializedSelectedPlanPayload | null;
  readonly isHost: boolean;
};

export type SerializedSelfPayload = Omit<
  SerializedPlayerPayload,
  "draftCount" | "hasSelected" | "hasSubmittedPlan" | "selectedCard" | "selected" | "isHost"
> & {
  readonly selected:
    | (SelectedPlanState & {
        readonly selectedCard: DomainCard | null;
        readonly attackPool: number;
        readonly defensePool: number;
      })
    | null;
};

export type SerializedDraftPayload = {
  readonly target: number;
  readonly budget: number;
  readonly currentPlayerId: string | null;
  readonly taken: string[];
  readonly pool: Array<{
    readonly card: DomainCard | undefined;
    readonly cost: number;
    readonly attackPool: number;
    readonly defensePool: number;
    readonly takenBy: string | null;
    readonly takenByName: string | null;
    readonly isAvailable: boolean;
    readonly canPick: boolean;
    readonly canAfford: boolean;
  }>;
};

export type SerializedLobbyPayload = {
  readonly id: string;
  readonly hostId: string;
  readonly phase: GamePhase;
  readonly round: number;
  readonly activePair: string[];
  readonly deadlineAt: number | null;
  readonly draft: SerializedDraftPayload | null;
  readonly chat: ChatMessage[];
  readonly lastResult: unknown;
  readonly winnerId: string | null;
  readonly players: SerializedPlayerPayload[];
  readonly self: SerializedSelfPayload | null;
};

export type SerializedStatePayload = Omit<ServerEventPayloads["state"], "lobby"> & {
  readonly lobby: SerializedLobbyPayload | null;
};

export type LobbySerializerOptions = {
  readonly SETTINGS: LobbySerializerSettings;
  readonly VALERIO_LABELS: Record<ValerioKey, string>;
  readonly clients: ClientMap;
  readonly lobbies: LobbyMap;
  readonly cardsById: Map<string, DomainCard>;
  readonly getClientLobby: (client: ClientState) => SerializedLobbyState | undefined;
  readonly getCurrentDrafterId: (lobby: SerializedLobbyState) => string | null;
  readonly isActiveDuelist: (lobby: SerializedLobbyState, playerId: string) => boolean;
  readonly hasSubmittedPlan: (player: PlayerState) => boolean;
  readonly canPlayerDraftCard: (
    lobby: SerializedLobbyState,
    player: PlayerState,
    card: DomainCard | undefined
  ) => { ok: boolean; error: string };
  readonly getAttackPool: (card: DomainCard | undefined) => number;
  readonly getDefensePool: (card: DomainCard | undefined) => number;
  readonly getDraftCost: (card: DomainCard | undefined) => number;
};

export declare class LobbySerializer {
  constructor(options: LobbySerializerOptions);

  serializeState(client: ClientState): SerializedStatePayload;
  serializeLobbyList(): ServerEventPayloads["state"]["lobbies"];
  serializeLobby(lobby: SerializedLobbyState, selfId: string): SerializedLobbyPayload;
}
