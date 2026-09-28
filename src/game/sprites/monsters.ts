// Procedural 48×48 "data monsters" for boss battles.

import type { BossDef } from '../../departments/sql/types';
import { INK, makeCanvas, px, shade, type Ctx } from './draw';

type Sprite = BossDef['sprite'];

interface Spec {
  body: string;
  accent: string;
  shape: 'blob' | 'ghost' | 'serpent' | 'boxy' | 'crab' | 'funnel' | 'swirl';
  eyes: number;
  heads?: number;
  extra?: 'horns' | 'hat' | 'crown' | 'briefcase' | 'eyepatch' | 'cards' | 'nulls' | 'minus' | 'tie' | 'clipboard';
}

const SPECS: Record<Sprite, Spec> = {
  gremlin: { body: '#8b5cf6', accent: '#ffd23f', shape: 'blob', eyes: 2, extra: 'nulls' },
  shuffler: { body: '#ff7a2f', accent: '#ffffff', shape: 'boxy', eyes: 2, extra: 'cards' },
  wraith: { body: '#9aa1ab', accent: '#3b82f6', shape: 'ghost', eyes: 2, extra: 'horns' },
  funnel: { body: '#14b8a6', accent: '#ffd23f', shape: 'funnel', eyes: 2 },
  crab: { body: '#e0473b', accent: '#ffd23f', shape: 'crab', eyes: 2 },
  phantom: { body: '#c4b5fd', accent: '#6d3fd6', shape: 'ghost', eyes: 2 },
  ogre: { body: '#6fa34a', accent: '#b07a4a', shape: 'blob', eyes: 1, extra: 'horns' },
  pirate: { body: '#2f4b8f', accent: '#ffd23f', shape: 'boxy', eyes: 1, extra: 'eyepatch' },
  anaconda: { body: '#37c46b', accent: '#ffd23f', shape: 'serpent', eyes: 2 },
  collector: { body: '#1f2937', accent: '#ffd23f', shape: 'boxy', eyes: 2, extra: 'briefcase' },
  specter: { body: '#e5e7eb', accent: '#ff4f5e', shape: 'ghost', eyes: 2, extra: 'minus' },
  hydra: { body: '#0e8a7c', accent: '#ffd23f', shape: 'serpent', eyes: 2, heads: 3 },
  orgchart: { body: '#f472b6', accent: '#ffffff', shape: 'boxy', eyes: 2, extra: 'clipboard' },
  tornado: { body: '#9aa1ab', accent: '#f472b6', shape: 'swirl', eyes: 2 },
  board: { body: '#2f4b8f', accent: '#ffd23f', shape: 'boxy', eyes: 2, extra: 'tie' },
};

function eyes(ctx: Ctx, cx: number, y: number, n: number, angry: boolean) {
  const xs = n === 1 ? [cx] : n === 2 ? [cx - 6, cx + 6] : [cx - 9, cx, cx + 9];
  for (const x of xs) {
    px(ctx, x - 3, y - 3, 7, 7, INK);
    px(ctx, x - 2, y - 2, 5, 5, '#ffffff');
    px(ctx, x - 1, y - 1, 3, 3, angry ? '#ff4f5e' : INK);
    if (angry) px(ctx, x - 3, y - 5, 7, 2, INK);
  }
}

function head(ctx: Ctx, x: number, y: number, s: Spec, r = 9) {
  px(ctx, x - r, y - r, r * 2, r * 2, INK);
  px(ctx, x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2, s.body);
  px(ctx, x - r + 2, y - r + 2, r - 2, 2, shade(s.body, 0.18));
  eyes(ctx, x, y - 1, 2, true);
  px(ctx, x - 4, y + 5, 8, 2, INK);
  for (let i = 0; i < 3; i++) px(ctx, x - 3 + i * 3, y + 5, 1, 2, '#ffffff');
}

/** phase: 0-based; later phases look angrier / grow extra parts. */
export function monsterCanvas(sprite: Sprite, phase = 0): HTMLCanvasElement {
  const s = SPECS[sprite];
  const [c, ctx] = makeCanvas(64, 64);
  const body = phase >= 2 ? shade(s.body, -0.12) : s.body;
  const hi = shade(body, 0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(12, 58, 40, 5);
  const angry = phase > 0;
  switch (s.shape) {
    case 'blob': {
      px(ctx, 12, 20, 40, 38, INK);
      px(ctx, 10, 26, 44, 28, INK);
      px(ctx, 13, 21, 38, 36, body);
      px(ctx, 11, 27, 42, 26, body);
      px(ctx, 15, 23, 14, 4, hi);
      eyes(ctx, 32, 34, s.eyes, angry);
      px(ctx, 24, 45, 16, 4, INK);
      px(ctx, 26, 45, 3, 3, '#ffffff');
      px(ctx, 35, 45, 3, 3, '#ffffff');
      px(ctx, 14, 56, 8, 4, INK);
      px(ctx, 42, 56, 8, 4, INK);
      break;
    }
    case 'ghost': {
      px(ctx, 14, 12, 36, 46, INK);
      px(ctx, 15, 13, 34, 44, body);
      px(ctx, 17, 15, 10, 4, hi);
      for (let x = 15; x < 49; x += 8) px(ctx, x, 54, 4, 4, '#00000000');
      for (let x = 15; x < 49; x += 8) {
        ctx.clearRect(x + 4, 52, 4, 6);
        px(ctx, x + 4, 51, 4, 1, INK);
      }
      eyes(ctx, 32, 28, s.eyes, angry);
      px(ctx, 26, 40, 12, 6, INK);
      px(ctx, 28, 42, 8, 3, s.accent);
      // clones for the phantom
      if (sprite === 'phantom' && phase > 0) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(c, 16, 0, 48, 64, 0, 4, 24, 32);
        ctx.drawImage(c, 0, 0, 48, 64, 44, 4, 24, 32);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'serpent': {
      // coiled body
      for (let i = 0; i < 3; i++) {
        px(ctx, 10 + i * 4, 46 - i * 6, 44 - i * 8, 10, INK);
        px(ctx, 11 + i * 4, 47 - i * 6, 42 - i * 8, 8, i % 2 ? body : shade(body, 0.08));
        for (let x = 14 + i * 4; x < 50 - i * 4; x += 6) px(ctx, x, 49 - i * 6, 2, 2, s.accent);
      }
      const heads = (s.heads ?? 1) + (sprite === 'hydra' ? phase * 2 : 0);
      const positions = [[32, 18], [16, 22], [48, 22], [8, 12], [56, 12], [24, 8], [40, 8]].slice(0, Math.min(7, heads));
      for (const [hx, hy] of positions) {
        px(ctx, hx - 2, hy + 6, 5, 18, INK);
        px(ctx, hx - 1, hy + 6, 3, 17, body);
        head(ctx, hx, hy, { ...s, body }, heads > 3 ? 6 : 8);
      }
      break;
    }
    case 'boxy': {
      px(ctx, 14, 18, 36, 38, INK);
      px(ctx, 15, 19, 34, 36, body);
      px(ctx, 17, 21, 10, 3, hi);
      eyes(ctx, 32, 30, s.eyes, angry);
      px(ctx, 25, 42, 14, 3, INK);
      // legs & arms
      px(ctx, 18, 56, 6, 5, INK);
      px(ctx, 40, 56, 6, 5, INK);
      px(ctx, 8, 30, 7, 4, INK);
      px(ctx, 49, 30, 7, 4, INK);
      break;
    }
    case 'crab': {
      px(ctx, 12, 28, 40, 24, INK);
      px(ctx, 13, 29, 38, 22, body);
      px(ctx, 16, 31, 12, 3, hi);
      for (let i = 0; i < 3; i++) {
        px(ctx, 6 - i, 44 + i * 4, 8, 2, INK);
        px(ctx, 50 + i, 44 + i * 4, 8, 2, INK);
      }
      // claws with two "keys"
      px(ctx, 2, 18, 12, 12, INK);
      px(ctx, 3, 19, 10, 10, body);
      px(ctx, 50, 18, 12, 12, INK);
      px(ctx, 51, 19, 10, 10, body);
      px(ctx, 5, 22, 6, 2, s.accent);
      px(ctx, 53, 22, 6, 2, s.accent);
      px(ctx, 24, 18, 2, 10, INK);
      px(ctx, 38, 18, 2, 10, INK);
      eyes(ctx, 32, 22, 2, angry);
      break;
    }
    case 'funnel': {
      for (let y = 10; y < 56; y += 2) {
        const w = Math.max(8, 48 - (y - 10) * 0.85);
        px(ctx, 32 - w / 2 - 1, y, w + 2, 2, INK);
        px(ctx, 32 - w / 2, y, w, 2, (y / 2) % 3 === 0 ? s.accent : body);
      }
      eyes(ctx, 32, 22, 2, angry);
      // leaking leads
      for (let i = 0; i < 3 + phase * 2; i++) px(ctx, 28 + (i % 3) * 3, 58 + (i % 2) * 2, 2, 2, s.accent);
      break;
    }
    case 'swirl': {
      for (let i = 0; i < 9; i++) {
        const w = 12 + i * 5;
        const y = 54 - i * 5;
        const off = Math.sin(i + phase) * 4;
        px(ctx, 32 - w / 2 + off - 1, y - 1, w + 2, 5, INK);
        px(ctx, 32 - w / 2 + off, y, w, 3, i % 2 ? body : shade(body, 0.12));
      }
      eyes(ctx, 32, 22, 2, angry);
      break;
    }
  }
  // extras
  switch (s.extra) {
    case 'horns':
      px(ctx, 16, 12, 4, 8, INK);
      px(ctx, 44, 12, 4, 8, INK);
      px(ctx, 17, 12, 2, 6, s.accent);
      px(ctx, 45, 12, 2, 6, s.accent);
      break;
    case 'eyepatch':
      px(ctx, 14, 26, 36, 2, INK);
      px(ctx, 36, 26, 8, 8, INK);
      px(ctx, 16, 12, 32, 6, INK);
      px(ctx, 12, 16, 40, 4, INK);
      px(ctx, 28, 13, 8, 3, '#ffffff');
      break;
    case 'briefcase':
      px(ctx, 48, 40, 14, 12, INK);
      px(ctx, 49, 41, 12, 10, '#b07a4a');
      px(ctx, 53, 38, 4, 3, INK);
      px(ctx, 28, 44, 8, 12, s.accent);
      px(ctx, 16, 12, 32, 5, INK); // hat
      px(ctx, 20, 6, 24, 7, INK);
      break;
    case 'cards':
      for (let i = 0; i < 3 + phase; i++) {
        px(ctx, 2 + i * 7, 4 + (i % 2) * 5, 8, 11, INK);
        px(ctx, 3 + i * 7, 5 + (i % 2) * 5, 6, 9, '#ffffff');
        px(ctx, 4 + i * 7, 8 + (i % 2) * 5, 4, 1, s.body);
      }
      break;
    case 'nulls':
      for (let i = 0; i < 2 + phase; i++) {
        px(ctx, 4 + i * 20, 4 + (i % 2) * 6, 13, 7, INK);
        px(ctx, 5 + i * 20, 5 + (i % 2) * 6, 11, 5, s.accent);
      }
      break;
    case 'minus':
      for (let i = 0; i < 3 + phase; i++) px(ctx, 6 + i * 14, 6 + (i % 2) * 6, 8, 3, s.accent);
      break;
    case 'clipboard':
      px(ctx, 46, 34, 14, 18, INK);
      px(ctx, 47, 35, 12, 16, '#ffffff');
      for (let y = 38; y < 50; y += 3) px(ctx, 49, y, 8, 1, '#9aa1ab');
      break;
    case 'tie':
      px(ctx, 30, 44, 4, 10, s.accent);
      px(ctx, 29, 43, 6, 2, INK);
      break;
    default:
      break;
  }
  if (phase >= 2) {
    // rage aura
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(255,79,94,0.25)';
    ctx.beginPath();
    ctx.arc(32, 34, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  return c;
}

export function monsterDataUrl(sprite: Sprite, phase: number, scale = 4): string {
  const small = monsterCanvas(sprite, phase);
  const [big, ctx] = makeCanvas(64 * scale, 64 * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, big.width, big.height);
  return big.toDataURL();
}
