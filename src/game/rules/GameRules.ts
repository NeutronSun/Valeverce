export interface GameRules {
  readonly startingHealth: number;
  readonly maxHealth: number;
  readonly startingMana: number;
  readonly maxMana: number;
  readonly roundManaGain: number;
  readonly cardValerioBudget: number;
  readonly maxAttackPoints: number;
  readonly maxDefensePoints: number;
  readonly attackSlots: number;
  readonly defenseSlots: number;
  readonly normalDamageCapRatio: number;
  readonly draftBudget: number;
  readonly draftSize: number;
  readonly handSize: number;
  readonly actionSeconds: number;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly cardCooldownRounds: number;
}

export type GameRuleOverrides = Partial<GameRules>;
