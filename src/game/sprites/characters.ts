// Walking character sprite sheets: 16×24 frames, 3 columns (stand, step A, step B)
// × 4 rows (down, left, right, up). Colors come from a "look".

import { INK, makeCanvas, px, shade, type Ctx } from './draw';

export interface CharLook {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'bun' | 'long' | 'bald' | 'cap' | 'curly' | 'buzz';
  shirt: string;
  pants?: string;
  accent?: string;
  beard?: boolean;
  glasses?: boolean;
}

export const FRAME_W = 16;
export const FRAME_H = 24;
export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];

function drawFrame(ctx: Ctx, ox: number, oy: number, look: CharLook, dir: Dir, step: 0 | 1 | 2) {
  const P = (x: number, y: number, w: number, h: number, c: string) => px(ctx, ox + x, oy + y, w, h, c);
  const pants = look.pants ?? '#34406b';
  const accent = look.accent ?? '#ffd23f';
  const skinD = shade(look.skin, -0.12);
  const hairD = shade(look.hair, -0.18);
  const bob = step === 0 ? 0 : 1;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(ox + 3, oy + 21, 10, 2);

  // legs
  const legY = 16;
  const l = step === 1 ? -1 : step === 2 ? 1 : 0;
  if (dir === 'left' || dir === 'right') {
    P(5 + l, legY, 3, 5, INK);
    P(8 - l, legY, 3, 5, INK);
    P(6 + l, legY, 1, 4, pants);
    P(9 - l, legY, 1, 4, pants);
    P(5 + l, legY + 4, 3, 1, '#1a1224');
    P(8 - l, legY + 4, 3, 1, '#1a1224');
  } else {
    P(4, legY, 4, 5 + (step === 1 ? -1 : 0), INK);
    P(8, legY, 4, 5 + (step === 2 ? -1 : 0), INK);
    P(5, legY, 2, 3 + (step === 1 ? -1 : 0), pants);
    P(9, legY, 2, 3 + (step === 2 ? -1 : 0), pants);
  }

  // torso
  const ty = 10 - bob;
  P(3, ty, 10, 8, INK);
  P(4, ty + 1, 8, 6, look.shirt);
  P(4, ty + 1, 8, 1, shade(look.shirt, 0.12));
  if (dir === 'down') {
    P(7, ty + 1, 2, 2, accent);
  }
  // arms
  const swing = step === 1 ? 1 : step === 2 ? -1 : 0;
  if (dir === 'down' || dir === 'up') {
    P(2, ty + 1 + swing, 2, 6, INK);
    P(12, ty + 1 - swing, 2, 6, INK);
    P(2, ty + 2 + swing, 1, 3, look.shirt);
    P(13, ty + 2 - swing, 1, 3, look.shirt);
    P(2, ty + 5 + swing, 2, 2, look.skin);
    P(12, ty + 5 - swing, 2, 2, look.skin);
  } else {
    const ax = dir === 'left' ? 6 + swing : 8 - swing;
    P(ax, ty + 1, 3, 6, INK);
    P(ax + 1, ty + 2, 1, 3, shade(look.shirt, -0.1));
    P(ax + 1, ty + 5, 1, 1, look.skin);
  }

  // head
  const hy = 1 - bob;
  P(3, hy, 10, 10, INK);
  P(4, hy + 1, 8, 8, look.skin);
  P(4, hy + 7, 8, 1, skinD);

  // hair
  const hs = look.hairStyle;
  if (hs === 'cap') {
    P(3, hy, 10, 4, INK);
    P(4, hy + 1, 8, 2, accent);
    if (dir === 'down') P(3, hy + 3, 10, 1, shade(accent, -0.25));
    if (dir === 'left') P(1, hy + 3, 5, 1, shade(accent, -0.25));
    if (dir === 'right') P(10, hy + 3, 5, 1, shade(accent, -0.25));
  } else if (hs !== 'bald') {
    P(4, hy + 1, 8, hs === 'buzz' ? 1 : 3, look.hair);
    if (hs === 'curly') {
      P(3, hy, 10, 3, look.hair);
      P(3, hy + 3, 1, 4, look.hair);
      P(12, hy + 3, 1, 4, look.hair);
    }
    if (hs === 'long' || hs === 'bun') {
      if (dir !== 'right') P(3, hy + 2, 2, dir === 'up' ? 9 : 7, look.hair);
      if (dir !== 'left') P(11, hy + 2, 2, dir === 'up' ? 9 : 7, look.hair);
    }
    if (hs === 'bun') {
      P(6, hy - 2, 4, 3, INK);
      P(7, hy - 1, 2, 2, look.hair);
    }
    P(4, hy + 1, 8, 1, hairD);
  }
  if (dir === 'up') {
    if (hs !== 'bald' && hs !== 'cap') P(4, hy + 1, 8, 7, look.hair);
    if (hs === 'cap') P(4, hy + 3, 8, 5, look.hair);
    return;
  }

  // face
  const ey = hy + 5;
  if (dir === 'down') {
    P(5, ey, 2, 2, INK);
    P(9, ey, 2, 2, INK);
    P(5, ey, 1, 1, '#ffffff');
    P(9, ey, 1, 1, '#ffffff');
    if (look.glasses) {
      P(4, ey - 1, 4, 1, INK);
      P(8, ey - 1, 4, 1, INK);
    }
    if (look.beard) P(4, hy + 7, 8, 2, look.hair);
    P(4, ey + 2, 1, 1, '#e99a8a');
    P(11, ey + 2, 1, 1, '#e99a8a');
  } else {
    const ex = dir === 'left' ? 5 : 9;
    P(ex, ey, 2, 2, INK);
    P(ex + (dir === 'left' ? 0 : 1), ey, 1, 1, '#ffffff');
    if (look.glasses) P(dir === 'left' ? 4 : 8, ey - 1, 4, 1, INK);
    if (look.beard) P(dir === 'left' ? 4 : 6, hy + 7, 6, 2, look.hair);
    // nose
    P(dir === 'left' ? 3 : 12, ey + 1, 1, 1, look.skin);
  }
}

/** Returns a 48×96 canvas: 3 frames × 4 directions. */
export function characterSheet(look: CharLook): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(FRAME_W * 3, FRAME_H * 4);
  DIRS.forEach((dir, row) => {
    ([0, 1, 2] as const).forEach((step) => drawFrame(ctx, step * FRAME_W, row * FRAME_H, look, dir, step));
  });
  return c;
}
