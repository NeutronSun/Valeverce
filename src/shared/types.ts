export type GamePhase = "lobby" | "draft" | "select" | "plan" | "reveal" | "ended";
export type ValerioKey = "V" | "A" | "L" | "E" | "R" | "I" | "O";

export type ValerioMap = Record<ValerioKey, number>;

export interface CardEffect {
  type: string;
  stat?: ValerioKey;
  count?: number;
  value?: number;
}

export interface CardAbility {
  name: string;
  cost?: number;
  text: string;
  effect?: CardEffect;
}

export interface Card {
  id: string;
  name: string;
  image?: string;
  rarity?: string;
  valerio: ValerioMap;
  combat: {
    attackPower: number;
    defensePower: number;
    draftCost: number;
  };
  active?: CardAbility;
  passive?: CardAbility;
}

export interface SelectedPlan {
  cardId: string;
  attacks: Partial<Record<ValerioKey, number>> | null;
  defenses: Partial<Record<ValerioKey, number>> | null;
  useActive: boolean | null;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  mana: number;
  deck: Card[];
  deckCount: number;
  draftSpent: number;
  draftBudget: number;
  draftBudgetRemaining: number;
  cooldowns: Record<string, number>;
  alive: boolean;
  isActive: boolean;
  isCurrentDrafter?: boolean;
  hasSelected?: boolean;
  hasSubmittedPlan?: boolean;
  selectedCard?: Card | null;
  selected?: SelectedPlan | null;
  isHost?: boolean;
}

export interface DraftCardSnapshot {
  card: Card;
  cost: number;
  attackPool: number;
  defensePool: number;
  takenBy: string | null;
  takenByName: string | null;
  isAvailable: boolean;
  canPick: boolean;
  canAfford: boolean;
}

export interface LobbySnapshot {
  id: string;
  hostId: string;
  phase: GamePhase;
  round: number;
  settings: {
    pickTimerEnabled: boolean;
    pickTimerSeconds: number;
    draftSize: number;
    draftBudget: number;
  };
  activePair: string[];
  deadlineAt: number | null;
  draft: {
    target: number;
    budget: number;
    currentPlayerId: string | null;
    taken: string[];
    pool: DraftCardSnapshot[];
  } | null;
  chat: ChatMessage[];
  lastResult: unknown;
  winnerId: string | null;
  players: PlayerSnapshot[];
  self: PlayerSnapshot | null;
}

export interface ChatMessage {
  id: string;
  createdAt: string;
  kind: "system" | "user";
  playerId: string | null;
  name: string | null;
  text: string;
}

export interface ClientEventPayloads {
  setName: { name: string };
  createLobby: Record<string, never>;
  joinLobby: { lobbyId: string };
  leaveLobby: Record<string, never>;
  updateLobbySettings: {
    pickTimerEnabled?: boolean;
    pickTimerSeconds?: number;
    draftSize?: number;
    draftBudget?: number;
  };
  startGame: Record<string, never>;
  draftCard: { cardId: string };
  selectCard: { cardId: string };
  submitPlan: {
    attacks: Partial<Record<ValerioKey, number>>;
    defenses: Partial<Record<ValerioKey, number>>;
    useActive: boolean;
  };
  nextRound: Record<string, never>;
  restartLobby: Record<string, never>;
  sendChat: { text: string };
  latencyProbe: { sentAt: number };
}

export interface ServerEventPayloads {
  hello: { type: "hello"; selfId: string };
  state: {
    type: "state";
    selfId: string;
    settings: Record<string, unknown>;
    valerioLabels: Record<ValerioKey, string>;
    onlinePlayers: number;
    lobbies: Array<{
      id: string;
      phase: GamePhase;
      hostName: string;
      players: number;
      maxPlayers: number;
      isJoinable: boolean;
      round: number;
      names: string[];
    }>;
    lobby: LobbySnapshot | null;
  };
  error: { type: "error"; message: string };
  lobbyList: { type: "lobbyList" };
}
