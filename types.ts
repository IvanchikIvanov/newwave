
export interface Vector2 {
  x: number;
  y: number;
}

export enum EntityType {
  PLAYER,
  WALL,
  PARTICLE,
  SWORD_HITBOX,
  BOMB
}

export type ObstacleType = 'WATER' | 'FENCE';

export interface Obstacle {
    id: string;
    type: ObstacleType;
    rect: { x: number, y: number, w: number, h: number };
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  active: boolean;
  hp?: number;
  maxHp?: number;
  angle?: number; // For rotation/facing
}

export interface Bomb extends Entity {
    timer: number;
    ownerId: string;
}

export interface Player extends Entity {
  type: EntityType.PLAYER;
  playerId: string; // Network ID
  
  // Movement / Dodge
  isDodging: boolean;
  dodgeTimer: number; 
  cooldown: number; // Dodge cooldown
  knockback: Vector2; // Physics impulse
  
  // Combat
  isBlocking: boolean;
  isAttacking: boolean;
  attackTimer: number; // For visual swing animation
  attackCooldown: number;
  
  // Bomb
  bombCooldown: number;
  
  // Stats
  score: number;
}

export interface Particle extends Entity {
  life: number; // 0 to 1
  decay: number;
}

export interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  obstacles: Obstacle[];
  bombs: Bomb[];
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
}

export interface PlayerInput {
  keys: string[]; // Serializable array of pressed keys
  mouse: Vector2; // World Coordinates
  mouseDown: boolean; // Attack
  middleMouseDown: boolean; // Bomb
}

export interface GameAssets {
  player: HTMLImageElement;
  sword: HTMLImageElement;
  shield: HTMLImageElement;
  grass: HTMLCanvasElement;
  water: HTMLCanvasElement;
  fence: HTMLImageElement;
  bomb: HTMLImageElement;
}
