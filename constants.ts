
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

// World is ~3x larger than the viewport
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 3000;

export const MAP_MARGIN = 96; // Border size for water/fences around the world

export const FPS = 60;
export const DT = 1 / FPS;

// Colors
export const COLORS = {
  background: '#18181b', // zinc-900
  floor: '#27272a', // zinc-800
  player: '#3b82f6', // blue-500
  playerDodge: '#93c5fd', // blue-300
  enemy: '#ef4444', // red-500
  shield: '#fbbf24', // amber-400
  sword: '#e4e4e7', // zinc-200
  wall: '#52525b', // zinc-600
  text: '#ffffff',
  blood: '#dc2626',
  bomb: '#18181b',
  explosion: '#f97316' // orange-500
};

// Gameplay Balance
export const PLAYER_HP = 100;
export const SWORD_DAMAGE = 25;
export const PLAYER_SPEED = 150; // Very slow movement speed
export const PLAYER_BLOCK_SPEED_MOD = 0.4; // Slower when blocking
export const PLAYER_DODGE_SPEED = 1200; // Faster and longer dodge
export const PLAYER_DODGE_DURATION = 0.5; // Increased duration
export const PLAYER_DODGE_COOLDOWN = 5.0; // Much longer cooldown for less frequent dodges
export const KNOCKBACK_FORCE = 1800; // Increased for stronger push
export const KNOCKBACK_DECAY = 0.9; // Friction for knockback

// Combat
export const SWORD_RANGE = 200; // Increased to be slightly larger than visual sword
export const SWORD_ARC = Math.PI / 1.5; // Wide swing
export const SWORD_COOLDOWN = 0.6;
export const SWORD_ATTACK_DURATION = 0.2; // Visual swing time
export const SHIELD_BLOCK_ANGLE = Math.PI / 1.2; // Frontal protection arc

// Passive Sword Physics
export const PASSIVE_SWORD_FORCE = 60; // Gentle push per frame when just touching
export const PASSIVE_SWORD_ARC = Math.PI / 5; // Narrower arc for idle sword

// Bomb
export const BOMB_TIMER = 1.6; // Seconds until explosion
export const BOMB_DAMAGE = 50;
export const BOMB_RADIUS = 250; // Explosion radius
export const BOMB_KNOCKBACK = 3000; // Very strong knockback
export const BOMB_COOLDOWN = 5.0; // Seconds