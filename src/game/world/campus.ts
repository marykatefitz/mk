// The Summit Trail RV campus layout and its ground painting.

import type { NpcId } from '../../core/characters';
import { INK, hash2, makeCanvas, px, shade } from '../sprites/draw';
import { RV_SIZE, type RvKind } from '../sprites/props';
import { BUILDINGS } from './buildings';

export const TILE = 16;
export const MAP_W = 80;
export const MAP_H = 57;

type Ground = 'grass' | 'road' | 'roadline' | 'sidewalk' | 'asphalt' | 'stall' | 'path' | 'flowers' | 'apron' | 'dirt';

const rects: [Ground, number, number, number, number][] = [
  // [type, x, y, w, h]
  ['sidewalk', 0, 0, MAP_W, 1],
  ['road', 0, 1, MAP_W, 4],
  ['sidewalk', 0, 5, MAP_W, 1],
  ['asphalt', 34, 5, 5, 13], // entrance driveway
  ['path', 2, 14, 76, 3], // north walkway
  ['asphalt', 2, 17, 43, 19], // sales lot
  ['apron', 59, 14, 19, 3],
  ['path', 55, 14, 2, 33], // east spine
  ['path', 49, 24, 2, 13], // lot office path
  ['path', 63, 25, 2, 3],
  ['path', 63, 34, 2, 3],
  ['path', 1, 36, 76, 2], // middle walkway
  ['path', 1, 45, 62, 2], // between south rows
  ['path', 1, 54, 62, 2], // bottom walkway
  ['path', 1, 36, 2, 20],
  ['path', 63, 36, 2, 20],
  ['flowers', 27, 13, 5, 1],
  ['flowers', 38, 13, 5, 1],
  ['dirt', 66, 52, 8, 1],
];

export function groundAt(x: number, y: number): Ground {
  let g: Ground = 'grass';
  for (const [t, rx, ry, rw, rh] of rects) {
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) g = t;
  }
  if (g === 'road' && y === 2 && x % 4 < 2) return 'roadline';
  return g;
}

/** Stall rows in the sales lot: RVs parked nose-up. */
export const STALL_ROWS = [18, 24, 30];
export const STALL_X0 = 3;
export const STALL_COUNT = 20;

export function paintGround(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(MAP_W * TILE, MAP_H * TILE);
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const g = groundAt(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      const r = hash2(tx, ty);
      switch (g) {
        case 'grass': {
          px(ctx, x, y, TILE, TILE, r < 0.5 ? '#79c85a' : '#73c254');
          for (let i = 0; i < 3; i++) {
            const gx = Math.floor(hash2(tx, ty, i + 1) * 14);
            const gy = Math.floor(hash2(tx, ty, i + 7) * 14);
            px(ctx, x + gx, y + gy, 1, 2, '#5aa843');
          }
          if (r > 0.94) {
            px(ctx, x + 6, y + 6, 2, 2, r > 0.97 ? '#ffffff' : '#ffd23f');
          }
          break;
        }
        case 'road':
          px(ctx, x, y, TILE, TILE, '#4b4f58');
          if (r > 0.8) px(ctx, x + Math.floor(r * 12), y + 5, 2, 1, '#555a64');
          break;
        case 'roadline':
          px(ctx, x, y, TILE, TILE, '#4b4f58');
          px(ctx, x, y + 14, TILE, 2, '#ffd23f');
          break;
        case 'sidewalk':
        case 'path':
          px(ctx, x, y, TILE, TILE, g === 'path' ? '#e8dcc0' : '#d9d4c7');
          px(ctx, x, y, TILE, 1, shade(g === 'path' ? '#e8dcc0' : '#d9d4c7', -0.06));
          px(ctx, x, y, 1, TILE, shade(g === 'path' ? '#e8dcc0' : '#d9d4c7', -0.06));
          break;
        case 'asphalt':
        case 'apron':
          px(ctx, x, y, TILE, TILE, g === 'apron' ? '#8a8f99' : '#6b7079');
          if (r > 0.7) px(ctx, x + Math.floor(r * 13), y + Math.floor(hash2(ty, tx) * 13), 2, 2, '#626770');
          break;
        case 'flowers':
          px(ctx, x, y, TILE, TILE, '#6b4430');
          for (let i = 0; i < 5; i++) {
            const fx = Math.floor(hash2(tx, ty, i) * 13);
            const fy = Math.floor(hash2(tx, ty, i + 9) * 13);
            px(ctx, x + fx, y + fy, 3, 3, ['#ff7a2f', '#ffd23f', '#f472b6', '#ffffff'][i % 4]);
          }
          break;
        case 'dirt':
          px(ctx, x, y, TILE, TILE, '#b08a5a');
          break;
        default:
          break;
      }
    }
  }
  // Parking stall lines
  for (const row of STALL_ROWS) {
    for (let i = 0; i <= STALL_COUNT; i++) {
      const x = (STALL_X0 + i * 2) * TILE;
      px(ctx, x, row * TILE + 2, 2, 3 * TILE + 4, '#f4eee0');
    }
  }
  // Lot curb
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(2 * TILE, 17 * TILE, 43 * TILE, 19 * TILE);
  // Big sign base at the entrance
  return c;
}

// ---------------------------------------------------------------- props ---

export interface PropPlacement {
  key: string;
  x: number; // px, bottom-center anchor
  y: number;
  collide?: { w: number; h: number };
}

export function propPlacements(): PropPlacement[] {
  const out: PropPlacement[] = [];
  const T = TILE;
  // trees along the road and edges
  const treeSpots: [number, number][] = [
    [1, 7], [14, 7], [25, 7], [45, 7], [58, 7], [78, 8], [1, 12], [78, 13],
    [0, 18], [0, 24], [0, 30], [46, 32], [53, 30], [71, 20], [74, 26], [72, 33], [78, 30],
    [13, 43], [25, 43], [37, 43], [50, 42], [61, 41], [61, 50], [76, 47], [77, 53], [14, 52], [26, 52], [38, 52], [58, 43],
  ];
  treeSpots.forEach(([tx, ty], i) => out.push({ key: `tree${i % 3}`, x: tx * T + 12, y: ty * T + 30, collide: { w: 8, h: 6 } }));
  // bushes in front of buildings
  for (const b of BUILDINGS) {
    if (b.y > 30) continue;
    out.push({ key: 'bush', x: (b.x + 1) * T, y: (b.y + b.h) * T + 10, collide: { w: 14, h: 6 } });
    out.push({ key: 'bush', x: (b.x + b.w - 1) * T, y: (b.y + b.h) * T + 10, collide: { w: 14, h: 6 } });
  }
  // lamps
  const lamps: [number, number][] = [[3, 17], [23, 17], [44, 17], [3, 35], [23, 35], [44, 35], [57, 20], [57, 44], [31, 47], [8, 47], [48, 16], [70, 16]];
  lamps.forEach(([tx, ty]) => out.push({ key: 'lamp', x: tx * T + 4, y: ty * T + 16, collide: { w: 4, h: 4 } }));
  // benches & cones
  out.push({ key: 'bench', x: 20 * T, y: 16 * T + 10 });
  out.push({ key: 'bench', x: 60 * T, y: 37 * T + 10 });
  for (let i = 0; i < 4; i++) out.push({ key: 'cone', x: (61 + i * 4) * T, y: 16 * T + 12 });
  return out;
}

export interface ParkedRv {
  kind: RvKind;
  stripe: number;
  x: number;
  y: number;
}

/** Deterministic parked RVs (a few empty stalls). */
export function parkedRvs(): ParkedRv[] {
  const kinds: RvKind[] = ['Travel Trailer', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler', 'Class C', 'Class A', 'Class B', 'Travel Trailer', 'Fifth Wheel'];
  const out: ParkedRv[] = [];
  STALL_ROWS.forEach((row, ri) => {
    for (let i = 0; i < STALL_COUNT; i++) {
      const r = hash2(i, ri, 42);
      if (r < 0.18) continue;
      const kind = kinds[Math.floor(hash2(i, ri, 7) * kinds.length)];
      const [, h] = RV_SIZE[kind];
      out.push({ kind, stripe: Math.floor(hash2(i, ri, 3) * 8), x: (STALL_X0 + i * 2 + 1) * TILE, y: row * TILE + 4 + h });
    }
  });
  return out;
}

export interface NpcSpot {
  npc: NpcId;
  x: number;
  y: number;
  facing: 'down' | 'left' | 'right' | 'up';
}

export const OUTDOOR_NPCS: NpcSpot[] = [
  { npc: 'rhonda', x: 39 * TILE, y: 16 * TILE, facing: 'down' },
  { npc: 'scout', x: 44 * TILE, y: 25 * TILE, facing: 'left' },
  { npc: 'tony', x: 32 * TILE, y: 15 * TILE + 8, facing: 'down' },
  { npc: 'walt', x: 22 * TILE, y: 15 * TILE + 8, facing: 'down' },
  { npc: 'marge', x: 10 * TILE, y: 15 * TILE + 8, facing: 'down' },
  { npc: 'priya', x: 66 * TILE, y: 15 * TILE + 8, facing: 'down' },
  { npc: 'earl', x: 74 * TILE, y: 15 * TILE + 4, facing: 'left' },
  { npc: 'devin', x: 61 * TILE, y: 26 * TILE, facing: 'down' },
  { npc: 'jess', x: 61 * TILE, y: 35 * TILE, facing: 'down' },
  { npc: 'nova', x: 22 * TILE, y: 46 * TILE, facing: 'down' },
];

export const PLAYER_SPAWN = { x: 36 * TILE + 8, y: 16 * TILE + 8 };
export const ARCADE_POS = { x: 50 * TILE, y: 31 * TILE };
