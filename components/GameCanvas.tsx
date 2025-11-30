
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, MAP_MARGIN, PLAYER_HP } from '../constants';
import { GameState, PlayerInput, GameAssets } from '../types';
import { createInitialState, updateGame, createPlayer, clamp } from '../utils/gameLogic';
import { generateAssets } from '../utils/assetGenerator';
import { Trophy, Users, Copy, Play, Sword, User } from 'lucide-react';

declare var Peer: any; 

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const assetsRef = useRef<GameAssets | null>(null);
  
  // Inputs
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{x: number, y: number}>({ x: 0, y: 0 }); // World Coordinates
  const mouseDownRef = useRef<boolean>(false);
  const middleMouseDownRef = useRef<boolean>(false);
  const cameraRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  // Networking
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null); 
  const hostConnsRef = useRef<any[]>([]); 
  
  const playerIdRef = useRef<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  
  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [peerId, setPeerId] = useState<string>('');
  
  const remoteInputsRef = useRef<Record<string, PlayerInput>>({});

  // UI State
  const [uiState, setUiState] = useState({ 
    status: 'MENU',
    playerCount: 0,
    assetsLoaded: false,
    winner: '',
    error: ''
  });

  const [inputRoomId, setInputRoomId] = useState('');

  // --- Asset Loading ---
  useEffect(() => {
    generateAssets().then(assets => {
        assetsRef.current = assets;
        setUiState(prev => ({ ...prev, assetsLoaded: true }));
    });
  }, []);

  // --- Networking Setup ---
  useEffect(() => {
    return () => {
        if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // Get ICE servers (STUN + TURN)
  const getIceServers = () => {
    const servers = [
      // STUN серверы (быстрые, прямые соединения) - пробуем первыми
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    // TURN сервер (надежный, через ретрансляцию) - используем как fallback
    const turnServer = import.meta.env.VITE_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnPassword = import.meta.env.VITE_TURN_PASSWORD;

    if (turnServer && turnUsername && turnPassword) {
      servers.push(
        {
          urls: `turn:${turnServer}:3478`,
          username: turnUsername,
          credential: turnPassword
        },
        {
          urls: `turn:${turnServer}:3478?transport=tcp`,
          username: turnUsername,
          credential: turnPassword
        }
      );
    }

    return servers;
  };

  const createRoom = () => {
    if (peerRef.current) peerRef.current.destroy();
    const peer = new Peer(null, { 
      debug: 2,
      // Use explicit PeerJS server configuration for better reliability
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      config: {
        iceServers: getIceServers()
      }
    });
    peerRef.current = peer;

    peer.on('open', (id: string) => {
        console.log('Peer opened with ID:', id);
        setPeerId(id);
        setRoomId(id);
        setIsHost(true);
        setPlayerId(id);
        playerIdRef.current = id;
        
        stateRef.current.status = 'LOBBY';
        setUiState(prev => ({ ...prev, status: 'LOBBY', playerCount: 1 }));
        
        stateRef.current.players = {
            [id]: createPlayer(id, 0)
        };
    });

    peer.on('error', (err: any) => {
        console.error('[HOST] Peer error:', err);
        console.error('[HOST] Error details:', JSON.stringify(err, null, 2));
        if (err.type === 'peer-unavailable') {
            console.log('[HOST] Peer unavailable, retrying...');
            setUiState(prev => ({ ...prev, error: 'Сервер недоступен. Попробуйте еще раз.' }));
        } else if (err.type === 'network') {
            console.log('[HOST] Network error, check connection');
            setUiState(prev => ({ ...prev, error: 'Ошибка сети. Проверьте подключение.' }));
        } else if (err.type === 'server-error') {
            console.error('[HOST] Server error - PeerJS server may be down');
            setUiState(prev => ({ ...prev, error: 'Сервер PeerJS недоступен. Попробуйте позже.' }));
        } else {
            setUiState(prev => ({ ...prev, error: `Ошибка подключения: ${err.message || err.type}` }));
        }
    });

    peer.on('connection', (conn: any) => {
        console.log('New connection from:', conn.peer);
        hostConnsRef.current.push(conn);
        conn.on('open', () => {
             console.log('[HOST] Connection opened from client:', conn.peer);
             console.log('[HOST] Client Peer ID (conn.peer):', conn.peer);
             const newPid = conn.peer;
             const idx = Object.keys(stateRef.current.players).length;
             
             if (!stateRef.current.players[newPid]) {
                 console.log('[HOST] Creating player for:', newPid);
                 stateRef.current.players[newPid] = createPlayer(newPid, idx);
             }
             
             console.log('[HOST] Current players:', Object.keys(stateRef.current.players));
             console.log('[HOST] Player IDs match check - Expected:', newPid, 'In players:', Object.keys(stateRef.current.players).includes(newPid));
             setUiState(prev => ({ ...prev, playerCount: Object.keys(stateRef.current.players).length }));
             try {
                console.log('[HOST] Sending initial STATE to new client:', newPid);
                conn.send({ type: 'STATE', payload: stateRef.current });
             } catch (e) { console.error('[HOST] Send error:', e); }
        });

        conn.on('data', (data: any) => {
            if (data.type === 'INPUT') {
                // Host receives input from client, use conn.peer as the key (matches client's myId)
                const clientId = conn.peer;
                console.log('[HOST] Received INPUT from client ID:', clientId);
                console.log('[HOST] Input keys:', data.payload.keys, 'Players in state:', Object.keys(stateRef.current.players));
                console.log('[HOST] Client ID exists in players?', Object.keys(stateRef.current.players).includes(clientId));
                remoteInputsRef.current[clientId] = data.payload;
                console.log('[HOST] Saved input for ID:', clientId, 'All remote inputs:', Object.keys(remoteInputsRef.current));
            }
        });

        conn.on('error', (err: any) => {
            console.error('[HOST] Connection error:', err);
            setUiState(prev => ({ ...prev, error: `Ошибка соединения: ${err.message || err.type}` }));
        });

        conn.on('close', () => {
            console.log('[HOST] Connection closed from:', conn.peer);
            const pid = conn.peer;
            delete stateRef.current.players[pid];
            delete remoteInputsRef.current[pid];
            hostConnsRef.current = hostConnsRef.current.filter(c => c !== conn);
            setUiState(prev => ({ ...prev, playerCount: Object.keys(stateRef.current.players).length }));
        });
    });
  };

  const joinRoom = () => {
    if (!inputRoomId) return;
    if (peerRef.current) peerRef.current.destroy();
    
    const peer = new Peer(null, { 
      debug: 2,
      // Use explicit PeerJS server configuration for better reliability
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      config: {
        iceServers: getIceServers()
      }
    });
    peerRef.current = peer;

    peer.on('open', (myId: string) => {
        console.log('Peer opened with ID:', myId);
        setPlayerId(myId);
        playerIdRef.current = myId;
        setPeerId(myId);
        
        const conn = peer.connect(inputRoomId, { reliable: true });
        connRef.current = conn;

        // Timeout for connection
        const connectionTimeout = setTimeout(() => {
            if (!conn.open) {
                console.error('[CLIENT] Connection timeout');
                setUiState(prev => ({ ...prev, error: 'Таймаут подключения. Проверьте ID комнаты и попробуйте еще раз.', status: 'MENU' }));
                peer.destroy();
            }
        }, 10000); // 10 seconds timeout

        conn.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('[CLIENT] Connection opened to:', inputRoomId);
            console.log('[CLIENT] My ID:', myId);
            setIsHost(false);
            setRoomId(inputRoomId);
            setUiState(prev => ({ ...prev, status: 'LOBBY', error: '' }));
        });

        conn.on('data', (data: any) => {
            if (data.type === 'STATE') {
                // Only log status changes, not every frame
                const prevStatus = stateRef.current.status;
                stateRef.current = data.payload;
                
                // Log state updates periodically (once per second) for debugging
                const now = Date.now();
                if (!(window as any).lastStateLog || now - (window as any).lastStateLog > 1000) {
                    console.log('[CLIENT] Received STATE update, status:', data.payload.status, 'players:', Object.keys(data.payload.players || {}).length);
                    (window as any).lastStateLog = now;
                }
                
                if (prevStatus !== data.payload.status) {
                    console.log('[CLIENT] Status changed:', prevStatus, '->', data.payload.status);
                }
                setUiState(prev => ({
                    ...prev,
                    status: data.payload.status,
                    playerCount: Object.keys(data.payload.players).length,
                    winner: data.payload.winnerId
                }));
            }
        });

        conn.on('error', (err: any) => {
            clearTimeout(connectionTimeout);
            console.error('[CLIENT] Connection error:', err);
            setUiState(prev => ({ ...prev, error: `Ошибка подключения: ${err.message || err.type}`, status: 'MENU' }));
        });

        conn.on('close', () => {
            clearTimeout(connectionTimeout);
            console.log('[CLIENT] Connection closed');
            setUiState(prev => ({ ...prev, status: 'MENU', error: 'Соединение закрыто' }));
        });
    });

    peer.on('error', (err: any) => {
        console.error('[CLIENT] Peer error:', err);
        console.error('[CLIENT] Error details:', JSON.stringify(err, null, 2));
        if (err.type === 'peer-unavailable') {
            setUiState(prev => ({ ...prev, error: 'Комната не найдена. Проверьте ID комнаты.', status: 'MENU' }));
        } else if (err.type === 'network') {
            setUiState(prev => ({ ...prev, error: 'Ошибка сети. Проверьте подключение.', status: 'MENU' }));
        } else if (err.type === 'server-error') {
            setUiState(prev => ({ ...prev, error: 'Сервер PeerJS недоступен. Попробуйте позже.', status: 'MENU' }));
        } else if (err.type === 'socket-error') {
            setUiState(prev => ({ ...prev, error: 'Ошибка WebSocket. Возможны проблемы с сетью или firewall.', status: 'MENU' }));
        } else {
            setUiState(prev => ({ ...prev, error: `Ошибка подключения: ${err.message || err.type}`, status: 'MENU' }));
        }
    });
  };

  const startHostedGame = () => {
      console.log('[HOST] Starting game, players:', Object.keys(stateRef.current.players));
      stateRef.current.status = 'PLAYING';
      hostConnsRef.current.forEach(c => {
          try { 
              if(c.open) {
                  console.log('[HOST] Sending START to client:', c.peer);
                  c.send({ type: 'STATE', payload: stateRef.current }); 
              }
          } catch(e){
              console.error('[HOST] Error sending start:', e);
          }
      });
  };

  const resetGame = () => {
    if (isHost) {
        const currentPlayers = Object.keys(stateRef.current.players);
        stateRef.current = createInitialState();
        stateRef.current.status = 'PLAYING';
        
        currentPlayers.forEach((pid, idx) => {
            stateRef.current.players[pid] = createPlayer(pid, idx);
        });

        setUiState(prev => ({
            ...prev,
            status: 'PLAYING',
            playerCount: currentPlayers.length,
        }));
    }
  };

  // --- Input Handlers ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => { keysRef.current.add(e.key.toLowerCase()); }, []);
  const handleKeyUp = useCallback((e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      const screenX = (e.clientX - rect.left) * scaleX;
      const screenY = (e.clientY - rect.top) * scaleY;
      
      // Convert to World Space: Mouse + Camera
      mouseRef.current = {
        x: screenX + cameraRef.current.x,
        y: screenY + cameraRef.current.y
      };
    }
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => { 
      if (e.button === 0) mouseDownRef.current = true; // Left
      if (e.button === 1) middleMouseDownRef.current = true; // Middle
  }, []);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => { 
      if (e.button === 0) mouseDownRef.current = false;
      if (e.button === 1) middleMouseDownRef.current = false;
  }, []);

  // Touch handlers for mobile
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && e.touches.length > 0) {
      const touch = e.touches[0];
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      const screenX = (touch.clientX - rect.left) * scaleX;
      const screenY = (touch.clientY - rect.top) * scaleY;
      
      mouseRef.current = {
        x: screenX + cameraRef.current.x,
        y: screenY + cameraRef.current.y
      };
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      mouseDownRef.current = true; // Single touch = attack
    } else if (e.touches.length === 2) {
      middleMouseDownRef.current = true; // Two touches = bomb
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      mouseDownRef.current = false;
      middleMouseDownRef.current = false;
    } else if (e.touches.length === 1) {
      middleMouseDownRef.current = false;
    }
  }, []);

  // --- Rendering ---
  const draw = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const assets = assetsRef.current;
    if (!assets) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
        return;
    }

    // --- Update Camera ---
    const myPlayer = state.players[playerIdRef.current];
    if (myPlayer && myPlayer.active) {
        // Target: Center player
        let targetX = myPlayer.pos.x - CANVAS_WIDTH / 2;
        let targetY = myPlayer.pos.y - CANVAS_HEIGHT / 2;
        
        // Clamp Camera to World Bounds
        targetX = Math.max(0, Math.min(targetX, WORLD_WIDTH - CANVAS_WIDTH));
        targetY = Math.max(0, Math.min(targetY, WORLD_HEIGHT - CANVAS_HEIGHT));
        
        // Smooth lerp (optional, instant for responsiveness)
        cameraRef.current.x = targetX;
        cameraRef.current.y = targetY;
    }
    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;

    // --- Draw World ---
    ctx.save();
    ctx.translate(-camX, -camY);

    // 1. Draw Water Background (World)
    const waterPat = ctx.createPattern(assets.water, 'repeat');
    if (waterPat) {
        ctx.fillStyle = waterPat;
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // 2. Draw Grass Island
    const grassPat = ctx.createPattern(assets.grass, 'repeat');
    if (grassPat) {
        ctx.fillStyle = grassPat;
        ctx.fillRect(MAP_MARGIN, MAP_MARGIN, WORLD_WIDTH - MAP_MARGIN * 2, WORLD_HEIGHT - MAP_MARGIN * 2);
    }

    // 3. Draw Obstacles (Pools and Fences inside map)
    const tileSize = 48;
    
    // Draw Obstacles
    if (state.obstacles) {
        state.obstacles.forEach(obs => {
            if (obs.type === 'WATER') {
                if (waterPat) {
                    ctx.fillStyle = waterPat;
                    ctx.fillRect(obs.rect.x, obs.rect.y, obs.rect.w, obs.rect.h);
                    // Add border
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(obs.rect.x, obs.rect.y, obs.rect.w, obs.rect.h);
                }
            } else if (obs.type === 'FENCE') {
                // Tiled Fence
                 for (let y = obs.rect.y; y < obs.rect.y + obs.rect.h; y+=tileSize) {
                    for (let x = obs.rect.x; x < obs.rect.x + obs.rect.w; x+=tileSize) {
                        ctx.drawImage(assets.fence, x, y, tileSize, tileSize);
                    }
                 }
            }
        });
    }

    // 4. Draw World Perimeter Fences
    // Top & Bottom
    for (let x = MAP_MARGIN; x < WORLD_WIDTH - MAP_MARGIN; x += tileSize) {
        ctx.drawImage(assets.fence, x, MAP_MARGIN - tileSize/2, tileSize, tileSize);
        ctx.drawImage(assets.fence, x, WORLD_HEIGHT - MAP_MARGIN - tileSize/2, tileSize, tileSize);
    }
    // Left & Right
    for (let y = MAP_MARGIN; y < WORLD_HEIGHT - MAP_MARGIN; y += tileSize) {
        ctx.drawImage(assets.fence, MAP_MARGIN - tileSize/2, y, tileSize, tileSize);
        ctx.drawImage(assets.fence, WORLD_WIDTH - MAP_MARGIN - tileSize/2, y, tileSize, tileSize);
    }
    
    // Shake
    const shakeX = (Math.random() - 0.5) * state.shake;
    const shakeY = (Math.random() - 0.5) * state.shake;
    ctx.translate(shakeX, shakeY);
    
    // Draw Bombs
    state.bombs.forEach(b => {
        ctx.save();
        ctx.translate(b.pos.x, b.pos.y);
        
        // Blink logic for fuse
        const isBlinking = Math.floor(b.timer * 10) % 2 === 0;
        
        // Draw Bomb sprite (3x size)
        ctx.scale(3, 3);
        ctx.drawImage(assets.bomb, -6, -6, 12, 12);
        
        ctx.restore();
    });

    // Draw Players
    Object.values(state.players).forEach(p => {
        if (!p.active) return;
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.rotate(p.angle || 0);

        // Draw Player Body
        const pSize = p.radius * 2.5;
        ctx.drawImage(assets.player, -pSize/2, -pSize/2, pSize, pSize);

        // Draw Shield
        if (p.isBlocking) {
            ctx.save();
            ctx.translate(10, 10); 
            ctx.rotate(Math.PI / 4); 
            ctx.drawImage(assets.shield, -12, -12, 24, 24);
            ctx.restore();
            
            ctx.beginPath();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.arc(0, 0, p.radius + 15, -Math.PI/3, Math.PI/3);
            ctx.stroke();
        } else {
             ctx.drawImage(assets.shield, -10, 5, 16, 16);
        }

        // Draw Sword (Huge Janissary Saber)
        ctx.save();
        ctx.translate(15, -10); // Shoulder position
        
        // Scale Sword 3x
        ctx.scale(3, 3);

        if (p.isAttacking) {
            const progress = 1 - (p.attackTimer / 0.2); 
            const swingAngle = -Math.PI/2 + (progress * Math.PI); 
            ctx.rotate(swingAngle);
            // Adjust draw pos for new pivot
            ctx.drawImage(assets.sword, 0, -32, 48, 48); 
            
            ctx.restore(); 
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Brighter slash
            ctx.lineWidth = 10;
            ctx.arc(0, 0, 150, -Math.PI/2, Math.PI/2); // Larger visual slash arc
            ctx.stroke();
        } else {
            ctx.rotate(Math.PI / 4); 
            ctx.drawImage(assets.sword, 0, -32, 48, 48);
            ctx.restore();
        }

        ctx.restore(); 
        
        // UI: ID
        ctx.fillStyle = '#fff';
        ctx.font = '24px "Press Start 2P"'; 
        ctx.textAlign = 'center';
        const isMe = p.playerId === playerIdRef.current;
        ctx.fillText(isMe ? 'YOU' : `P${p.playerId.slice(0,2)}`, p.pos.x, p.pos.y - 50);
        
        // UI: Health Bar (Bg)
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(p.pos.x - 25, p.pos.y + 40, 50, 6);
        
        // UI: Health Bar (Fg)
        const hpPct = clamp((p.hp || 0) / (p.maxHp || PLAYER_HP), 0, 1);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.2 ? '#eab308' : '#ef4444');
        ctx.fillRect(p.pos.x - 25, p.pos.y + 40, 50 * hpPct, 6);

        // UI: Stamina (Small under HP)
        if (p.cooldown > 0) {
            ctx.fillStyle = '#60a5fa';
            ctx.fillRect(p.pos.x - 20, p.pos.y + 50, 40 * (1 - p.cooldown), 3);
        }
        
        // UI: Bomb CD (Small orange under Stamina)
        if (p.bombCooldown > 0) {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(p.pos.x - 20, p.pos.y + 55, 40 * (1 - p.bombCooldown/5.0), 3);
        }
    });

    // Draw Particles
    state.particles.forEach(pt => {
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.pos.x, pt.pos.y, pt.radius, pt.radius);
        ctx.globalAlpha = 1.0;
    });

    // Cursor (World Space)
    if (state.status === 'PLAYING') {
      const mx = mouseRef.current.x; // Already in world space
      const my = mouseRef.current.y;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI*2);
      ctx.fill();
    }
    
    ctx.restore(); // Undo shake and camera

    // --- HUD (Screen Space) ---
    // Mini-map or position indicator could go here, but keeping it lite
    
  };

  // --- Game Loop ---
  const tick = useCallback(() => {
    try {
        const tickStart = performance.now();
        
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const myId = playerIdRef.current;
        // Use peerId for client too, as it matches conn.peer on host side
        const clientId = !isHost ? peerId : myId;

        if (isHost && stateRef.current.status === 'PLAYING') {
            // Collect all inputs
        const myInput: PlayerInput = {
            keys: Array.from(keysRef.current),
            mouse: mouseRef.current,
            mouseDown: mouseDownRef.current,
            middleMouseDown: middleMouseDownRef.current
        };
            // Host uses peerId (room ID) for its own input
            const allInputs = { ...remoteInputsRef.current, [peerId]: myInput };
            
            // Update Game
            const newState = updateGame(stateRef.current, allInputs);
            stateRef.current = newState;

            // Broadcast State (throttled to ~60 FPS for smoother gameplay)
            const now = Date.now();
            
            // Debug: Log inputs once per second
            if (!(window as any).lastInputLog || now - (window as any).lastInputLog > 1000) {
                console.log('[HOST] Inputs check - Players:', Object.keys(stateRef.current.players), 'Input keys:', Object.keys(allInputs), 'Remote inputs:', Object.keys(remoteInputsRef.current));
                (window as any).lastInputLog = now;
            }
            
            // Reduced throttling to 16ms (~60 FPS) for better responsiveness
            if (!(window as any).lastBroadcast || now - (window as any).lastBroadcast > 16) {
                hostConnsRef.current.forEach(c => {
                     try { 
                         if(c.open) {
                             c.send({ type: 'STATE', payload: newState }); 
                         } else {
                             console.warn('[HOST] Connection not open for:', c.peer);
                         }
                     } catch(e) {
                         console.error('[HOST] Error sending state:', e);
                     }
                });
                (window as any).lastBroadcast = now;
            }

            // Update Host UI
            const myP = newState.players[peerId];
            setUiState({
                status: newState.status,
                playerCount: Object.keys(newState.players).length,
                assetsLoaded: true,
                winner: newState.winnerId || ''
            });
    } else if (!isHost && stateRef.current.status === 'PLAYING') {
        // Client: Send Input - peerId matches conn.peer on host side
        if (connRef.current && connRef.current.open) {
            try {
                const hasKeys = keysRef.current.size > 0;
                const hasMouse = mouseDownRef.current || middleMouseDownRef.current;
                // Log only when there's actual input
                if (hasKeys || hasMouse) {
                    const now = Date.now();
                    if (!(window as any).lastClientInputLog || now - (window as any).lastClientInputLog > 500) {
                        console.log('[CLIENT] Sending INPUT, peerId:', peerId, 'keys:', Array.from(keysRef.current));
                        (window as any).lastClientInputLog = now;
                    }
                }
                connRef.current.send({
                    type: 'INPUT',
                    payload: {
                        keys: Array.from(keysRef.current),
                        mouse: mouseRef.current,
                        mouseDown: mouseDownRef.current,
                        middleMouseDown: middleMouseDownRef.current
                    }
                });
            } catch(e) {
                console.error('[CLIENT] Error sending input:', e);
            }
        } else {
            // Log connection issue only once
            if (!(window as any).clientConnWarningLogged) {
                console.warn('[CLIENT] Connection issue - connRef:', !!connRef.current, 'open:', connRef.current?.open, 'peerId:', peerId);
                (window as any).clientConnWarningLogged = true;
            }
        }
    }

    // Always Draw current state (Host computes it, Client receives it)
    draw(ctx, stateRef.current);
    
    // Performance monitoring (only log slow frames)
    const tickTime = performance.now() - tickStart;
    if (tickTime > 20 && !isHost) {
        // Only log on client side to avoid spam
        const now = Date.now();
        if (!(window as any).lastSlowFrameLog || now - (window as any).lastSlowFrameLog > 2000) {
            console.warn('[CLIENT] Slow frame detected:', tickTime.toFixed(2), 'ms - canvas may be too large');
            (window as any).lastSlowFrameLog = now;
        }
    }
    
    requestRef.current = requestAnimationFrame(tick);
    } catch (e) {
        console.error('[GAME LOOP] Error in tick:', e);
        // Continue the loop even if there's an error
        requestRef.current = requestAnimationFrame(tick);
    }
  }, [isHost, peerId]); // Dependencies

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tick, handleKeyDown, handleKeyUp]);


  return (
    <div className={`relative group w-full h-full bg-zinc-900 flex items-center justify-center ${uiState.status === 'PLAYING' ? 'cursor-none' : 'cursor-default'}`}>
        <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            className="block shadow-2xl bg-black w-full h-full object-contain touch-none"
        />

        {/* CONTROLS HUD */}
        <div className="absolute top-4 right-4 text-xs text-white/50 font-[monospace] flex flex-col gap-1 items-end pointer-events-none">
            <div className="hidden md:flex flex-col gap-1">
                <div className="flex items-center gap-2">MOVE <kbd className="bg-zinc-800 p-1 rounded">WASD</kbd></div>
                <div className="flex items-center gap-2">ATTACK <kbd className="bg-zinc-800 p-1 rounded">L-CLICK</kbd></div>
                <div className="flex items-center gap-2">BOMB <kbd className="bg-zinc-800 p-1 rounded">M-CLICK</kbd></div>
                <div className="flex items-center gap-2">BLOCK <kbd className="bg-zinc-800 p-1 rounded">SPACE</kbd></div>
                <div className="flex items-center gap-2">DODGE <kbd className="bg-zinc-800 p-1 rounded">SHIFT</kbd></div>
            </div>
            <div className="md:hidden text-xs">
                <div>TOUCH: Move & Attack</div>
                <div>2 FINGERS: Bomb</div>
            </div>
        </div>

        {/* Menu */}
        {uiState.status === 'MENU' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white font-[monospace]">
                <h1 className="text-6xl font-extrabold text-red-600 mb-8 tracking-tighter">DUEL ARENA</h1>
                <div className="flex flex-col gap-4 w-64">
                    {uiState.error && (
                        <div className="bg-red-900/80 border border-red-600 px-4 py-3 rounded text-sm text-red-200 text-center">
                            {uiState.error}
                        </div>
                    )}
                    <button onClick={createRoom} className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded flex items-center justify-center gap-2">
                        <Sword size={20} /> CREATE ARENA
                    </button>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="ROOM ID" 
                            value={inputRoomId}
                            onChange={(e) => {
                                setInputRoomId(e.target.value);
                                setUiState(prev => ({ ...prev, error: '' })); // Clear error when typing
                            }}
                            className="flex-1 bg-zinc-800 border border-zinc-600 px-3 py-2 text-sm text-center tracking-widest uppercase focus:outline-none focus:border-red-500"
                        />
                    </div>
                    <button onClick={joinRoom} className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded flex items-center justify-center gap-2">
                        JOIN ARENA
                    </button>
                </div>
            </div>
        )}

        {/* Lobby */}
        {uiState.status === 'LOBBY' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white font-[monospace]">
                <h2 className="text-3xl font-bold mb-6 text-gray-300">WAITING FOR CHALLENGERS</h2>
                {isHost && (
                    <div className="bg-zinc-800 p-4 rounded border border-zinc-600 mb-8 flex flex-col items-center gap-2">
                        <span className="text-gray-400 text-xs">ARENA ID</span>
                        <div className="flex items-center gap-2">
                            <code className="text-2xl font-bold tracking-widest text-yellow-400 select-all">{roomId}</code>
                            <button onClick={() => navigator.clipboard.writeText(roomId)} className="p-2 hover:bg-zinc-700 rounded"><Copy size={16} /></button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Открой эту страницу в другом окне/устройстве и введи этот ID</p>
                    </div>
                )}
                <div className="mb-8 flex items-center gap-2 text-gray-300 animate-pulse">
                    <Users size={20} />
                    <span>{uiState.playerCount} Gladiator(s) Ready</span>
                </div>
                {uiState.error && (
                    <div className="mb-4 text-red-500 text-sm bg-red-900/30 px-4 py-2 rounded">
                        {uiState.error}
                    </div>
                )}
                {isHost && uiState.playerCount > 1 && (
                    <button onClick={startHostedGame} className="px-8 py-4 bg-green-700 hover:bg-green-600 text-white font-bold text-xl rounded flex items-center gap-2 animate-bounce">
                        <Play size={24} /> FIGHT!
                    </button>
                )}
                {isHost && uiState.playerCount <= 1 && (
                    <div className="text-red-500 text-sm">Need at least 2 players to start</div>
                )}
                {!isHost && <p className="text-gray-500">Sharpening blade...</p>}
            </div>
        )}

        {/* Victory */}
        {uiState.status === 'VICTORY' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white font-[monospace]">
                {uiState.winner === playerIdRef.current ? (
                    <>
                        <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce" />
                        <h2 className="text-5xl font-bold text-yellow-400 mb-2">VICTORY</h2>
                        <p className="text-gray-400 mb-8">You are the champion</p>
                    </>
                ) : (
                    <>
                        <User size={80} className="text-gray-600 mb-4" />
                        <h2 className="text-5xl font-bold text-red-600 mb-2">DEFEATED</h2>
                        <p className="text-gray-400 mb-8">Better luck next time</p>
                    </>
                )}
                
                {isHost && (
                    <button onClick={resetGame} className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded flex items-center gap-2">
                         RESET ROUND
                    </button>
                )}
            </div>
        )}
    </div>
  );
};

export default GameCanvas;
