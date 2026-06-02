export type GamePhase = "lobby" | "draft" | "select" | "plan" | "reveal" | "ended";
export type ValerioKey = "V" | "A" | "L" | "E" | "R" | "I" | "O";
export type CardType = "attack" | "utility" | "trap" | "defense";
export type CardRole = CardType;
export type RoundIntent = "combat" | "guard" | "draw" | "focus" | "recover" | "utility" | "trap" | "control";
export type EffectTarget = "self" | "enemy" | "chosen_card";
export type CardZone = "deck" | "hand" | "selected" | "discard";
export type CardSelection = "random_hand" | "random_deck" | "chosen_hand" | "chosen_deck" | "selected_card";
export type TrapTriggerType =
  | "enemy_attacks"
  | "enemy_uses_active"
  | "enemy_uses_utility"
  | "enemy_draws"
  | "enemy_focuses"
  | "enemy_controls";

export type ValerioMap = Record<ValerioKey, number>;

export type ProfileColorId = "gold" | "green" | "blue" | "red" | "violet" | "teal" | "pink" | "orange";

export interface ProfileAvatarSnapshot {
  kind: "initials";
  initials: string;
  colorId: ProfileColorId;
}

export interface PlayerProfileSnapshot {
  profileId: string;
  username: string;
  avatar: ProfileAvatarSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface CardEffect {
  type: string;
  stat?: ValerioKey;
  stats?: ValerioKey[];
  count?: number;
  value?: number;
  target?: EffectTarget;
  source?: CardZone;
  destination?: CardZone;
  selection?: CardSelection;
  targetCardId?: string;
}

export interface TrapTrigger {
  type: TrapTriggerType;
  intent?: RoundIntent;
  stat?: ValerioKey;
}

export interface CardAbility {
  name: string;
  cost?: number;
  timing?: string;
  text: string;
  effect?: CardEffect;
  effects?: CardEffect[];
}

export interface Card {
  id: string;
  name: string;
  type?: CardType;
  role?: CardRole;
  image?: string;
  rarity?: string;
  allowedIntents?: RoundIntent[];
  effects?: CardEffect[];
  guardBonus?: number;
  trigger?: TrapTrigger;
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
  profile?: PlayerProfileSnapshot;
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
  utilityDeckReady?: boolean;
  utilityDeck?: Card[];
  utilityHand?: Card[];
  utilityHandCount?: number;
  utilityDrawCount?: number;
  utilityDiscard?: Card[];
  utilityDiscardCount?: number;
  armedTraps?: ArmedTrapSnapshot[];
  armedTrapCount?: number;
  privateEffectLog?: EffectLogEntry[];
  isActive: boolean;
  isCurrentDrafter?: boolean;
  hasSelected?: boolean;
  hasSubmittedPlan?: boolean;
  selectedCard?: Card | null;
  selected?: SelectedPlan | null;
  isHost?: boolean;
}

export interface ArmedTrapSnapshot {
  id: string;
  cardId: string;
  card: Card | null;
  armedRound: number;
  trigger: TrapTrigger | null;
}

export interface EffectLogEntry {
  id: string;
  round?: number;
  text: string;
}

export interface EffectWindowSnapshot {
  id: string;
  round: number;
  status: "waiting" | "closed";
  playerIds: string[];
  submissions: Record<
    string,
    {
      type: "card" | "trap" | "pass";
      cardId: string | null;
      targetPlayerId: string | null;
    }
  >;
  publicLog: EffectLogEntry[];
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
  effectWindow: EffectWindowSnapshot | null;
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
  upsertProfile: { profile: PlayerProfileSnapshot };
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
  selectUtilityDeck: { cardIds: string[] };
  selectCard: { cardId: string };
  submitPlan: {
    attacks: Partial<Record<ValerioKey, number>>;
    defenses: Partial<Record<ValerioKey, number>>;
    useActive: boolean;
  };
  playEffectCard: { cardId: string; targetPlayerId?: string | null };
  passEffectWindow: Record<string, never>;
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
    profile: PlayerProfileSnapshot;
    settings: Record<string, unknown>;
    valerioLabels: Record<ValerioKey, string>;
    onlinePlayers: number;
    lobbies: Array<{
      id: string;
      phase: GamePhase;
      hostName: string;
      hostProfile?: PlayerProfileSnapshot;
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
