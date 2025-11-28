
import { COLORS } from '../constants';
import { GameAssets } from '../types';

// 0: Transparent
const PALETTE = {
  player: { 1: '#3b82f6', 2: '#1d4ed8', 3: '#60a5fa', 4: '#1e293b' }, // Blue Knight
  sword: { 1: '#e4e4e7', 2: '#a1a1aa', 3: '#ffffff', 4: '#52525b' }, // Steel
  shield: { 1: '#d97706', 2: '#92400e', 3: '#fbbf24', 4: '#451a03' },  // Wood/Gold
  fence:  { 1: '#78350f', 2: '#5b21b6', 3: '#92400e', 4: '#000000' },   // Wood
  bomb:   { 1: '#18181b', 2: '#3f3f46', 3: '#ef4444', 4: '#fbbf24' }    // Black bomb, red fuse, spark
};

// 12x12 Pixel Grids
const SPRITES = {
  player: [
    [0,0,0,0,1,1,1,1,0,0,0,0], 
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,3,3,1,1,1,0,0],
    [0,0,1,4,4,4,4,4,4,1,0,0], 
    [0,0,1,4,4,4,4,4,4,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,2,2,2,2,2,2,0,0,0], 
    [0,0,2,2,1,1,1,1,2,2,0,0], 
    [0,0,2,1,1,1,1,1,1,2,0,0],
    [0,0,2,1,1,1,1,1,1,2,0,0],
    [0,0,0,2,2,0,0,2,2,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  sword: [
    [0,0,0,0,0,0,1,1,1,0,0,0], // Tip
    [0,0,0,0,0,1,1,2,2,0,0,0],
    [0,0,0,0,1,1,2,2,0,0,0,0],
    [0,0,0,0,1,2,2,0,0,0,0,0], // Belly
    [0,0,0,0,1,2,0,0,0,0,0,0],
    [0,0,0,1,1,2,0,0,0,0,0,0],
    [0,0,0,1,2,0,0,0,0,0,0,0],
    [0,0,1,1,2,0,0,0,0,0,0,0],
    [0,4,4,4,4,0,0,0,0,0,0,0], // Guard
    [4,4,4,0,0,0,0,0,0,0,0,0], // Handle
    [0,4,0,0,0,0,0,0,0,0,0,0],
    [4,4,0,0,0,0,0,0,0,0,0,0]
  ],
  shield: [
    [0,0,0,0,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,3,3,3,3,1,1,1,0],
    [0,1,1,3,1,1,1,1,3,1,1,0],
    [1,1,3,1,1,4,4,1,1,3,1,1],
    [1,1,3,1,4,2,2,4,1,3,1,1],
    [1,1,3,1,4,2,2,4,1,3,1,1],
    [1,1,3,1,1,4,4,1,1,3,1,1],
    [0,1,1,3,1,1,1,1,3,1,1,0],
    [0,0,1,1,3,3,3,3,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,1,1,0,0,0,0],
  ],
  fence: [
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,3,3,3,3,3,3,3,3,3,3,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,3,3,3,3,3,3,3,3,3,3,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0],
  ],
  bomb: [
    [0,0,0,0,0,0,4,0,0,0,0,0], // Spark
    [0,0,0,0,0,3,3,0,0,0,0,0], // Fuse
    [0,0,0,0,0,3,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,0,0,0,0], // Body
    [0,0,1,1,1,2,1,1,1,0,0,0],
    [0,1,1,1,1,2,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ]
};

const createValuesMap = (palette: any) => (val: number) => palette[val] || null;

const renderToImage = (grid: number[][], palette: any, scale: number = 4): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const size = grid.length;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const getColor = createValuesMap(palette);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const color = getColor(grid[y][x]);
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }
    }
    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => resolve(img);
  });
};

const createPatternCanvas = (width: number, height: number, drawFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) drawFn(ctx);
    return canvas;
};

const createGrassPattern = (): HTMLCanvasElement => {
    return createPatternCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#4ade80'; // base green
        ctx.fillRect(0,0,64,64);
        
        // Grass blades
        for(let i=0; i<40; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#22c55e' : '#86efac';
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const h = Math.random() * 3 + 1;
            ctx.fillRect(x, y, 2, h);
        }
    });
};

const createWaterPattern = (): HTMLCanvasElement => {
     return createPatternCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#3b82f6'; // base blue
        ctx.fillRect(0,0,64,64);
        
        // Ripples
        ctx.fillStyle = '#60a5fa';
        for(let i=0; i<8; i++) {
             const x = Math.random() * 64;
             const y = Math.random() * 64;
             ctx.fillRect(x, y, 6, 2);
        }
    });
};

export const generateAssets = async (): Promise<GameAssets> => {
    const [player, sword, shield, fence, bomb] = await Promise.all([
        renderToImage(SPRITES.player, PALETTE.player, 4),
        renderToImage(SPRITES.sword, PALETTE.sword, 4), 
        renderToImage(SPRITES.shield, PALETTE.shield, 4),
        renderToImage(SPRITES.fence, PALETTE.fence, 4), // 48x48
        renderToImage(SPRITES.bomb, PALETTE.bomb, 4)
    ]);
    
    return {
        player,
        sword,
        shield,
        fence,
        bomb,
        grass: createGrassPattern(),
        water: createWaterPattern()
    };
};
