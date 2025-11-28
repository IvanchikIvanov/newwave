
import { GameState, Player, EntityType, Vector2, PlayerInput, Particle, Obstacle, Bomb } from '../types';
import { 
  WORLD_WIDTH, WORLD_HEIGHT, MAP_MARGIN, DT, COLORS, PLAYER_HP, SWORD_DAMAGE,
  PLAYER_SPEED, PLAYER_DODGE_SPEED, PLAYER_DODGE_DURATION, PLAYER_DODGE_COOLDOWN,
  PLAYER_BLOCK_SPEED_MOD, SWORD_RANGE, SWORD_COOLDOWN, 
  SWORD_ATTACK_DURATION, SHIELD_BLOCK_ANGLE, SWORD_ARC, KNOCKBACK_FORCE, KNOCKBACK_DECAY,
  BOMB_TIMER, BOMB_DAMAGE, BOMB_RADIUS, BOMB_KNOCKBACK, BOMB_COOLDOWN,
  PASSIVE_SWORD_FORCE, PASSIVE_SWORD_ARC
} from '../constants';

// --- Helpers ---
const dist = (v1: Vector2, v2: Vector2) => Math.hypot(v2.x - v1.x, v2.y - v1.y);
const normalize = (v: Vector2): Vector2 => {
  const m = Math.hypot(v.x, v.y);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
const angleDiff = (a: number, b: number) => {
    const diff = Math.abs(a - b) % (Math.PI * 2);
    return diff > Math.PI ? (Math.PI * 2) - diff : diff;
};

// Check Circle vs Rectangle Collision
const checkCircleRect = (circlePos: Vector2, radius: number, rect: {x:number, y:number, w:number, h:number}) => {
    const testX = clamp(circlePos.x, rect.x, rect.x + rect.w);
    const testY = clamp(circlePos.y, rect.y, rect.y + rect.h);
    const distX = circlePos.x - testX;
    const distY = circlePos.y - testY;
    const distance = Math.sqrt((distX * distX) + (distY * distY));
    return distance <= radius;
};

// --- Map Generation ---
const generateObstacles = (): Obstacle[] => {
    const obstacles: Obstacle[] = [];
    const count = 40; 
    const minSize = 100;
    const maxSize = 300;

    // Define safe zones (spawn points)
    const safeZones = [
        { x: WORLD_WIDTH/2 - 200, y: WORLD_HEIGHT/2, r: 400 }, // Player 1 spawn area
        { x: WORLD_WIDTH/2 + 200, y: WORLD_HEIGHT/2, r: 400 }, // Player 2 spawn area
    ];

    for (let i = 0; i < count; i++) {
        const isWater = Math.random() > 0.6; // 40% chance of water
        const w = minSize + Math.random() * (maxSize - minSize);
        const h = minSize + Math.random() * (maxSize - minSize);
        const x = MAP_MARGIN + Math.random() * (WORLD_WIDTH - MAP_MARGIN * 2 - w);
        const y = MAP_MARGIN + Math.random() * (WORLD_HEIGHT - MAP_MARGIN * 2 - h);
        
        // Check safe zones
        const cx = x + w/2;
        const cy = y + h/2;
        let safe = true;
        for (const zone of safeZones) {
             if (Math.hypot(cx - zone.x, cy - zone.y) < zone.r + Math.max(w,h)/2) {
                 safe = false;
                 break;
             }
        }
        
        if (safe) {
            obstacles.push({
                id: `obs-${i}`,
                type: isWater ? 'WATER' : 'FENCE',
                rect: { x, y, w, h }
            });
        }
    }
    return obstacles;
};

// --- Initialization ---
export const createInitialState = (): GameState => ({
  status: 'MENU',
  shake: 0,
  players: {}, 
  particles: [],
  obstacles: generateObstacles(),
  bombs: []
});

export const createPlayer = (id: string, index: number): Player => ({
  id: `p-${id}`,
  playerId: id,
  type: EntityType.PLAYER,
  pos: { 
      // Spawn somewhat near the center but apart
      x: WORLD_WIDTH / 2 + (index === 0 ? -300 : 300), 
      y: WORLD_HEIGHT / 2 
  },
  vel: { x: 0, y: 0 },
  radius: 16,
  color: index === 0 ? COLORS.player : COLORS.enemy,
  active: true,
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
  isDodging: false,
  dodgeTimer: 0,
  cooldown: 0, // Dodge CD
  angle: index === 0 ? 0 : Math.PI, // Face each other
  isBlocking: false,
  isAttacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  score: 0,
  knockback: { x: 0, y: 0 },
  bombCooldown: 0
});

// --- Update Loop ---
export const updateGame = (
  state: GameState, 
  inputs: Record<string, PlayerInput>
): GameState => {
  if (state.status !== 'PLAYING') return state;

  let newParticles = [...state.particles];
  let newBombs = [...state.bombs];
  let newShake = Math.max(0, state.shake - 1);
  const playerIds = Object.keys(state.players);
  let activeCount = 0;
  let lastSurvivor = '';

  playerIds.forEach(pid => {
    const player = state.players[pid];
    if (!player.active) return;
    activeCount++;
    lastSurvivor = pid;

    const input = inputs[pid] || { keys: [], mouse: player.pos, mouseDown: false, middleMouseDown: false };
    const keySet = new Set(input.keys);

    // --- Physics / Knockback Decay ---
    player.knockback.x *= KNOCKBACK_DECAY;
    player.knockback.y *= KNOCKBACK_DECAY;
    if (Math.abs(player.knockback.x) < 5) player.knockback.x = 0;
    if (Math.abs(player.knockback.y) < 5) player.knockback.y = 0;

    // --- Cooldowns ---
    player.attackCooldown = Math.max(0, player.attackCooldown - DT);
    player.cooldown = Math.max(0, player.cooldown - DT);
    player.attackTimer = Math.max(0, player.attackTimer - DT);
    player.bombCooldown = Math.max(0, player.bombCooldown - DT);

    // --- Aiming ---
    const dx = input.mouse.x - player.pos.x;
    const dy = input.mouse.y - player.pos.y;
    const targetAngle = Math.atan2(dy, dx);
    player.angle = targetAngle; // Instant turn

    // --- Actions ---
    // Shield (Space)
    player.isBlocking = keySet.has(' ') && !player.isAttacking && !player.isDodging;

    // Bomb (Middle Mouse)
    if (input.middleMouseDown && player.bombCooldown <= 0) {
        player.bombCooldown = BOMB_COOLDOWN;
        const spawnDist = 40;
        const bx = player.pos.x + Math.cos(player.angle) * spawnDist;
        const by = player.pos.y + Math.sin(player.angle) * spawnDist;
        
        newBombs.push({
            id: `bomb-${Date.now()}-${Math.random()}`,
            type: EntityType.BOMB,
            ownerId: pid,
            pos: { x: bx, y: by },
            vel: { x: 0, y: 0 },
            radius: 12,
            active: true,
            color: COLORS.bomb,
            timer: BOMB_TIMER
        });
    }

    // Attack (Left Click)
    if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging && !player.isBlocking) {
        player.isAttacking = true;
        player.attackTimer = SWORD_ATTACK_DURATION;
        player.attackCooldown = SWORD_COOLDOWN;
        
        // Attack Logic: Check Hits
        playerIds.forEach(targetId => {
            if (targetId === pid) return;
            const target = state.players[targetId];
            if (!target.active) return;

            const d = dist(player.pos, target.pos);
            if (d < SWORD_RANGE) {
                const angleToTarget = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
                const aDiff = angleDiff(player.angle || 0, angleToTarget);
                
                // Check Arc
                if (aDiff < SWORD_ARC / 2) {
                    // HIT! Check block
                    let blocked = false;
                    if (target.isBlocking) {
                        // To block, target must face attacker (angle difference approx PI)
                        const angleToAttacker = Math.atan2(player.pos.y - target.pos.y, player.pos.x - target.pos.x);
                        const blockDiff = angleDiff(target.angle || 0, angleToAttacker);
                        if (blockDiff < SHIELD_BLOCK_ANGLE / 2) {
                            blocked = true;
                        }
                    }

                    if (blocked) {
                        // Block Effect
                        newShake += 5;
                        for(let i=0; i<5; i++) newParticles.push(createParticle(target.pos, COLORS.shield, 4));
                        
                        // Pushback Attacker slightly
                        const pushDir = normalize({ x: player.pos.x - target.pos.x, y: player.pos.y - target.pos.y });
                        player.knockback = { x: pushDir.x * 400, y: pushDir.y * 400 };

                        // Pushback Defender slightly
                        const defDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                        target.knockback = { x: defDir.x * 400, y: defDir.y * 400 };
                    } else if (!target.isDodging) {
                        // HIT!
                        if (target.hp !== undefined) target.hp -= SWORD_DAMAGE;
                        
                        // Apply Knockback Logic
                        // Sword swings from "Left" to "Right" (Clockwise relative to player facing)
                        // Knockback = Away Vector + Swing Direction Vector
                        
                        const attackAngle = player.angle || 0;
                        
                        // 1. Vector directly away from attacker
                        const awayDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                        
                        // 2. Vector representing swing momentum (Tangential, to the Right of attacker)
                        const swingDir = { x: -Math.sin(attackAngle), y: Math.cos(attackAngle) };
                        
                        // Combine vectors: Push mostly away, but significantly in direction of swing
                        const combinedDir = normalize({
                            x: awayDir.x + swingDir.x * 0.6, 
                            y: awayDir.y + swingDir.y * 0.6
                        });

                        target.knockback = { x: combinedDir.x * KNOCKBACK_FORCE, y: combinedDir.y * KNOCKBACK_FORCE };

                        newShake += 10;
                        for(let i=0; i<10; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 8));

                        if (target.hp !== undefined && target.hp <= 0) {
                             target.active = false;
                             newShake += 20;
                             for(let i=0; i<20; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 12));
                        }
                    }
                }
            }
        });
    } else if (!player.isAttacking && !player.isDodging) {
        // PASSIVE SWORD PHYSICS:
        // If not attacking, the sword is still there and can push people.
        playerIds.forEach(targetId => {
            if (targetId === pid) return;
            const target = state.players[targetId];
            if (!target.active) return;
            
            const d = dist(player.pos, target.pos);
            // Slightly shorter range for passive body collision
            if (d < SWORD_RANGE * 0.9) {
                // Idle sword is roughly at +45deg (PI/4) relative to player facing
                const swordAngle = (player.angle || 0) + Math.PI / 4;
                const angleToTarget = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
                const aDiff = angleDiff(swordAngle, angleToTarget);
                
                // If target is in the narrow cone of the idle sword
                if (aDiff < PASSIVE_SWORD_ARC) { 
                     // Push target away from player
                     const pushDir = normalize({ 
                        x: target.pos.x - player.pos.x, 
                        y: target.pos.y - player.pos.y 
                     });
                     
                     // Add gentle force
                     target.knockback.x += pushDir.x * PASSIVE_SWORD_FORCE;
                     target.knockback.y += pushDir.y * PASSIVE_SWORD_FORCE;
                }
            }
        });
    }
    
    if (player.attackTimer <= 0) player.isAttacking = false;

    // Dodge (Shift)
    if (keySet.has('shift') && !player.isDodging && player.cooldown <= 0 && !player.isBlocking) {
        let dashDir = { x: 0, y: 0 };
        if (keySet.has('w')) dashDir.y -= 1;
        if (keySet.has('s')) dashDir.y += 1;
        if (keySet.has('a')) dashDir.x -= 1;
        if (keySet.has('d')) dashDir.x += 1;
        
        // Only dodge if there is input movement (Ignore mouse direction fallback)
        if (dashDir.x !== 0 || dashDir.y !== 0) {
            player.isDodging = true;
            player.dodgeTimer = PLAYER_DODGE_DURATION;
            player.cooldown = PLAYER_DODGE_COOLDOWN;
            
            dashDir = normalize(dashDir);
            player.vel = { x: dashDir.x * PLAYER_DODGE_SPEED, y: dashDir.y * PLAYER_DODGE_SPEED };
            
            // Particle Trail
            for(let i=0; i<3; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 2));
        }
    }

    // Movement
    if (player.isDodging) {
        player.dodgeTimer -= DT;
        if (player.dodgeTimer <= 0) {
            player.isDodging = false;
            player.vel = { x: 0, y: 0 };
        }
    } else {
        // Normal Move
        let moveDir = { x: 0, y: 0 };
        if (keySet.has('w')) moveDir.y -= 1;
        if (keySet.has('s')) moveDir.y += 1;
        if (keySet.has('a')) moveDir.x -= 1;
        if (keySet.has('d')) moveDir.x += 1;
        moveDir = normalize(moveDir);

        let speed = PLAYER_SPEED;
        if (player.isBlocking) speed *= PLAYER_BLOCK_SPEED_MOD;
        if (player.isAttacking) speed *= 0.2; // Slow when swinging

        player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
    }

    // Proposed Position (Velocity + Knockback)
    let nextX = player.pos.x + (player.vel.x + player.knockback.x) * DT;
    let nextY = player.pos.y + (player.vel.y + player.knockback.y) * DT;

    // World Boundary Check (Fences)
    const minX = MAP_MARGIN + player.radius;
    const maxX = WORLD_WIDTH - MAP_MARGIN - player.radius;
    const minY = MAP_MARGIN + player.radius;
    const maxY = WORLD_HEIGHT - MAP_MARGIN - player.radius;

    nextX = clamp(nextX, minX, maxX);
    nextY = clamp(nextY, minY, maxY);

    // Obstacle Collision
    let collides = false;
    for (const obs of state.obstacles) {
        if (checkCircleRect({x: nextX, y: nextY}, player.radius, obs.rect)) {
            collides = true;
            break;
        }
    }

    // If collision, try sliding (simple axis check)
    if (collides) {
        // Try X only
        let testX = nextX;
        let testY = player.pos.y;
        let colX = false;
        for (const obs of state.obstacles) {
            if (checkCircleRect({x: testX, y: testY}, player.radius, obs.rect)) {
                colX = true; break;
            }
        }
        
        // Try Y only
        testX = player.pos.x;
        testY = nextY;
        let colY = false;
        for (const obs of state.obstacles) {
            if (checkCircleRect({x: testX, y: testY}, player.radius, obs.rect)) {
                colY = true; break;
            }
        }

        if (!colX) {
            player.pos.x = nextX;
        }
        if (!colY) {
            player.pos.y = nextY;
        }
    } else {
        player.pos.x = nextX;
        player.pos.y = nextY;
    }

  });
  
  // --- Bomb Logic ---
  newBombs.forEach(bomb => {
      bomb.timer -= DT;
  });
  
  // Handle Exploded Bombs
  const explodedBombs = newBombs.filter(b => b.timer <= 0);
  newBombs = newBombs.filter(b => b.timer > 0);
  
  explodedBombs.forEach(bomb => {
      // Effects
      newShake += 25;
      for(let i=0; i<30; i++) newParticles.push(createParticle(bomb.pos, COLORS.explosion, 8));
      
      // Damage & Knockback to ALL players (including self, or just enemies? Prompt: "от себя всех")
      // Interpreting as: Knock everyone away from the bomb
      playerIds.forEach(pid => {
          const p = state.players[pid];
          if (!p.active) return;
          
          const d = dist(bomb.pos, p.pos);
          if (d < BOMB_RADIUS) {
              if (p.hp !== undefined) p.hp -= BOMB_DAMAGE;
              
              // Knockback direction: From Bomb Center -> Player
              const kbDir = normalize({ x: p.pos.x - bomb.pos.x, y: p.pos.y - bomb.pos.y });
              
              p.knockback = { 
                  x: kbDir.x * BOMB_KNOCKBACK, 
                  y: kbDir.y * BOMB_KNOCKBACK 
              };
              
              // Blood particles
              for(let i=0; i<10; i++) newParticles.push(createParticle(p.pos, COLORS.blood, 5));

              if (p.hp !== undefined && p.hp <= 0) {
                   p.active = false;
                   newShake += 10;
              }
          }
      });
  });

  // --- Particles ---
  newParticles.forEach(p => {
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= DT * p.decay;
  });
  newParticles = newParticles.filter(p => p.life > 0);

  // --- Win Condition ---
  if (activeCount === 1 && playerIds.length > 1) {
      return { ...state, status: 'VICTORY', winnerId: lastSurvivor, particles: newParticles, shake: newShake, bombs: newBombs };
  }

  return {
    ...state,
    particles: newParticles,
    bombs: newBombs,
    shake: newShake
  };
};

const createParticle = (pos: Vector2, color: string, speedMod: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 50 * speedMod;
    return {
        id: `p-${Math.random()}`,
        type: EntityType.PARTICLE,
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: Math.random() * 3 + 1,
        color: color,
        active: true,
        life: 1.0,
        decay: Math.random() * 3 + 2
    };
};