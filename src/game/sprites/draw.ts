// Shared canvas helpers for procedural pixel art.

export type Ctx = CanvasRenderingContext2D;

export const INK = '#2b1d3a';

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Filled rect with a 1px ink outline. */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, outline = INK) {
  px(ctx, x, y, w, h, outline);
  px(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`;
}

/** Deterministic hash → [0,1) for per-tile variation. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tiny 3×5 pixel font for signs painted into textures. */
const FONT: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '110', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'], '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'], '2': ['110', '001', '010', '100', '111'], '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '110', '001', '110'], '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '110'],
  '&': ['010', '101', '010', '101', '011'], '-': ['000', '000', '111', '000', '000'], '.': ['000', '000', '000', '000', '010'],
  '!': ['010', '010', '010', '000', '010'], '?': ['110', '001', '010', '000', '010'], ' ': ['000', '000', '000', '000', '000'],
  '/': ['001', '001', '010', '100', '100'], '+': ['000', '010', '111', '010', '000'], ':': ['000', '010', '000', '010', '000'],
};

export function textWidth(s: string) {
  return s.length * 4 - 1;
}

export function drawText(ctx: Ctx, s: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) if (row[rx] === '1') ctx.fillRect(cx + rx, y + ry, 1, 1);
    });
    cx += 4;
  }
}
