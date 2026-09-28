// Procedural 32×32 pixel-art portraits. Pure canvas drawing, so the same code
// feeds React <canvas> elements and Phaser textures.

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'bun' | 'long' | 'bald' | 'cap' | 'curly' | 'buzz';
  shirt: string;
  accent: string;
  glasses?: boolean;
  beard?: boolean;
}

export type Expression = 'neutral' | 'happy' | 'stressed' | 'surprised';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const OUTLINE = '#2b1d3a';

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** Draw a portrait into a 32×32 area at (ox, oy). */
export function paintPortrait(ctx: Ctx, look: Look, expr: Expression = 'neutral', ox = 0, oy = 0, bg?: string) {
  const R = (x: number, y: number, w: number, h: number, c: string) => rect(ctx, ox + x, oy + y, w, h, c);
  if (bg) R(0, 0, 32, 32, bg);
  const skinD = shade(look.skin, -0.12);
  const hairD = shade(look.hair, -0.15);

  // shoulders / shirt
  R(5, 26, 22, 6, OUTLINE);
  R(6, 27, 20, 5, look.shirt);
  R(6, 27, 20, 1, shade(look.shirt, 0.12));
  R(14, 27, 4, 2, look.accent); // collar / tie accent
  R(15, 29, 2, 3, look.accent);
  // neck
  R(13, 23, 6, 4, skinD);

  // long hair behind the head
  if (look.hairStyle === 'long') {
    R(7, 9, 18, 17, OUTLINE);
    R(8, 10, 16, 16, look.hair);
  }
  if (look.hairStyle === 'bun') {
    R(12, 1, 8, 5, OUTLINE);
    R(13, 2, 6, 4, look.hair);
  }

  // head
  R(8, 6, 16, 18, OUTLINE);
  R(9, 7, 14, 16, look.skin);
  R(9, 20, 14, 3, skinD);
  // ears
  R(7, 13, 2, 4, OUTLINE);
  R(23, 13, 2, 4, OUTLINE);
  R(7, 14, 1, 2, look.skin);
  R(24, 14, 1, 2, look.skin);

  // hair on top
  switch (look.hairStyle) {
    case 'short':
      R(8, 5, 16, 5, OUTLINE);
      R(9, 6, 14, 4, look.hair);
      R(9, 10, 3, 2, look.hair);
      R(20, 10, 3, 1, look.hair);
      break;
    case 'buzz':
      R(9, 6, 14, 3, hairD);
      break;
    case 'curly':
      for (let i = 0; i < 6; i++) {
        R(7 + i * 3, 3 + (i % 2), 4, 4, OUTLINE);
        R(8 + i * 3, 4 + (i % 2), 3, 3, look.hair);
      }
      R(8, 7, 16, 3, look.hair);
      R(7, 9, 2, 6, look.hair);
      R(23, 9, 2, 6, look.hair);
      break;
    case 'long':
    case 'bun':
      R(8, 5, 16, 5, OUTLINE);
      R(9, 6, 14, 4, look.hair);
      R(9, 10, 2, 8, look.hair);
      R(21, 10, 2, 8, look.hair);
      break;
    case 'cap':
      R(7, 4, 18, 6, OUTLINE);
      R(8, 5, 16, 4, look.accent);
      R(8, 8, 19, 2, OUTLINE);
      R(9, 8, 17, 1, shade(look.accent, -0.2));
      R(9, 10, 2, 3, look.hair);
      R(21, 10, 2, 3, look.hair);
      break;
    case 'bald':
      R(10, 7, 4, 1, shade(look.skin, 0.12));
      break;
  }

  // eyes
  const eyeY = 14;
  if (expr === 'happy') {
    R(11, eyeY, 3, 1, OUTLINE);
    R(18, eyeY, 3, 1, OUTLINE);
    R(11, eyeY - 1, 1, 1, OUTLINE);
    R(13, eyeY - 1, 1, 1, OUTLINE);
    R(18, eyeY - 1, 1, 1, OUTLINE);
    R(20, eyeY - 1, 1, 1, OUTLINE);
  } else if (expr === 'surprised') {
    R(11, eyeY - 1, 3, 3, '#ffffff');
    R(18, eyeY - 1, 3, 3, '#ffffff');
    R(12, eyeY, 1, 1, OUTLINE);
    R(19, eyeY, 1, 1, OUTLINE);
  } else {
    R(11, eyeY, 3, 2, '#ffffff');
    R(18, eyeY, 3, 2, '#ffffff');
    R(12, eyeY, 2, 2, OUTLINE);
    R(19, eyeY, 2, 2, OUTLINE);
  }
  // brows
  if (expr === 'stressed') {
    R(10, eyeY - 3, 3, 1, hairD);
    R(13, eyeY - 2, 1, 1, hairD);
    R(19, eyeY - 3, 3, 1, hairD);
    R(18, eyeY - 2, 1, 1, hairD);
  } else {
    R(11, eyeY - 2, 3, 1, hairD);
    R(18, eyeY - 2, 3, 1, hairD);
  }
  if (look.glasses) {
    R(10, eyeY - 1, 5, 1, OUTLINE);
    R(17, eyeY - 1, 5, 1, OUTLINE);
    R(10, eyeY + 2, 5, 1, OUTLINE);
    R(17, eyeY + 2, 5, 1, OUTLINE);
    R(10, eyeY - 1, 1, 4, OUTLINE);
    R(14, eyeY - 1, 1, 4, OUTLINE);
    R(17, eyeY - 1, 1, 4, OUTLINE);
    R(21, eyeY - 1, 1, 4, OUTLINE);
    R(15, eyeY, 2, 1, OUTLINE);
  }
  // nose
  R(15, 16, 2, 2, skinD);
  // cheeks
  R(10, 17, 2, 1, shade(look.skin, 0.05) === look.skin ? '#f4a3a3' : '#e99a8a');
  R(20, 17, 2, 1, '#e99a8a');
  // beard
  if (look.beard) {
    R(9, 18, 14, 5, look.hair);
    R(10, 23, 12, 1, look.hair);
    R(13, 19, 6, 1, skinD);
  }
  // mouth
  const mouthY = 20;
  if (expr === 'happy') {
    R(13, mouthY, 6, 1, OUTLINE);
    R(14, mouthY + 1, 4, 1, '#c0392b');
  } else if (expr === 'stressed') {
    R(13, mouthY + 1, 6, 1, OUTLINE);
    R(13, mouthY, 1, 1, OUTLINE);
    R(18, mouthY, 1, 1, OUTLINE);
  } else if (expr === 'surprised') {
    R(15, mouthY, 2, 2, OUTLINE);
  } else {
    R(14, mouthY, 4, 1, OUTLINE);
  }
}

const cache = new Map<string, string>();

/** Portrait as a data URL (scaled up with crisp pixels), cached. */
export function portraitDataUrl(look: Look, expr: Expression = 'neutral', scale = 4, bg = '#ffe8b8'): string {
  const key = JSON.stringify([look, expr, scale, bg]);
  const hit = cache.get(key);
  if (hit) return hit;
  const small = document.createElement('canvas');
  small.width = 32;
  small.height = 32;
  paintPortrait(small.getContext('2d')!, look, expr, 0, 0, bg);
  const big = document.createElement('canvas');
  big.width = 32 * scale;
  big.height = 32 * scale;
  const bctx = big.getContext('2d')!;
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  const url = big.toDataURL();
  cache.set(key, url);
  return url;
}
