import { INK, box, drawText, hash2, makeCanvas, px, shade, textWidth } from './draw';

export type BuildingStyle = 'shack' | 'showroom' | 'office' | 'bay' | 'vault' | 'hq' | 'data' | 'people' | 'tower' | 'factory' | 'garage' | 'lab' | 'studio' | 'basement';

export interface BuildingLook {
  w: number; // px
  h: number; // px
  wall: string;
  roof: string;
  trim: string;
  style: BuildingStyle;
  label: string;
  locked: boolean;
}

/** 3/4 top-down building: roof on top, front wall facing south, door centered at the bottom. */
export function buildingCanvas(b: BuildingLook): HTMLCanvasElement {
  const { w, h } = b;
  const [c, ctx] = makeCanvas(w, h + 4);
  const wallH = b.style === 'tower' ? Math.round(h * 0.7) : Math.max(26, Math.round(h * 0.42));
  const roofH = h - wallH;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(3, h - 2, w - 3, 6);

  // roof
  box(ctx, 0, 0, w, roofH + 2, b.roof);
  for (let y = 3; y < roofH - 1; y += 4) {
    for (let x = 2; x < w - 2; x += 8) {
      px(ctx, x + ((y / 4) % 2) * 4, y, 6, 1, shade(b.roof, -0.08));
    }
  }
  px(ctx, 1, 1, w - 2, 2, shade(b.roof, 0.12));
  // roof extras
  if (b.style === 'factory') {
    for (let i = 0; i < 2; i++) {
      box(ctx, 8 + i * 18, -0 + 2, 8, roofH - 4, '#8a8f99');
      px(ctx, 9 + i * 18, 3, 6, 2, '#5a5f69');
    }
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = shade(b.roof, -0.15);
      ctx.beginPath();
      ctx.moveTo(x, roofH);
      ctx.lineTo(x + 6, roofH - 7);
      ctx.lineTo(x + 12, roofH);
      ctx.fill();
    }
  }
  if (b.style === 'bay' || b.style === 'office' || b.style === 'hq' || b.style === 'data') {
    box(ctx, w - 26, 5, 14, 9, '#b8c2cc'); // HVAC
    px(ctx, w - 24, 7, 10, 1, '#8fa3b8');
  }
  if (b.style === 'lab') {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(w / 2, roofH / 2 + 2, Math.min(w, roofH) / 3 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfe7ff';
    ctx.beginPath();
    ctx.arc(w / 2, roofH / 2 + 2, Math.min(w, roofH) / 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (b.style === 'tower') {
    // snowflake emblem
    const cx = w / 2;
    const cy = roofH / 2 + 1;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * Math.PI) / 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-7, -1, 14, 2);
      ctx.restore();
    }
  }

  // wall
  const wy = roofH;
  box(ctx, 0, wy, w, wallH, b.wall);
  px(ctx, 1, wy + 1, w - 2, 2, b.trim);
  px(ctx, 1, h - 3, w - 2, 2, shade(b.wall, -0.15));

  const doorW = b.style === 'bay' ? 14 : 12;
  const doorX = Math.round(w / 2 - doorW / 2);
  const doorH = Math.min(16, wallH - 6);

  // windows / bay doors / glass
  if (b.style === 'showroom') {
    for (let x = 4; x < w - 4; x += 14) {
      if (x + 12 > doorX && x < doorX + doorW) continue;
      box(ctx, x, wy + 6, 12, wallH - 10, '#7fc4ef');
      px(ctx, x + 2, wy + 8, 3, wallH - 16, '#d7f0ff');
    }
  } else if (b.style === 'bay') {
    for (let i = 0; i < 3; i++) {
      const bx = 6 + i * Math.floor((w - 12) / 3);
      if (Math.abs(bx + 11 - w / 2) < 14) continue;
      box(ctx, bx, wy + 6, 22, wallH - 8, '#c9ced6');
      for (let y = wy + 9; y < h - 4; y += 3) px(ctx, bx + 2, y, 18, 1, '#9aa1ab');
    }
  } else if (b.style === 'vault') {
    for (let x = 6; x < w - 6; x += 16) {
      if (Math.abs(x + 3 - w / 2) < 12) continue;
      box(ctx, x, wy + 8, 7, 8, '#7fc4ef');
    }
    // pillars
    for (let x = 3; x < w; x += 10) px(ctx, x, wy + 4, 3, wallH - 6, shade(b.wall, 0.1));
  } else if (b.style !== 'basement') {
    const step = b.style === 'tower' ? 10 : 14;
    const rows = b.style === 'tower' ? Math.floor((wallH - 20) / 12) : 1;
    for (let r = 0; r < rows; r++) {
      for (let x = 5; x < w - 8; x += step) {
        if (r === rows - 1 && x + 8 > doorX - 2 && x < doorX + doorW + 2) continue;
        const lit = hash2(x, r, w) > 0.5;
        box(ctx, x, wy + 6 + r * 12, 8, 8, lit ? '#ffe9a8' : '#7fc4ef');
        px(ctx, x + 1, wy + 7 + r * 12, 2, 2, '#ffffff99');
      }
    }
  } else {
    // basement: stairs going down
    box(ctx, doorX - 4, wy + 4, doorW + 8, wallH - 6, '#6b7280');
    for (let y = wy + 6; y < h - 4; y += 3) px(ctx, doorX - 2, y, doorW + 4, 1, '#4b5563');
  }

  // door
  if (b.style !== 'basement') {
    box(ctx, doorX, h - doorH - 2, doorW, doorH + 1, b.style === 'vault' ? '#9aa1ab' : b.style === 'showroom' ? '#7fc4ef' : shade(b.wall, -0.35));
    if (b.style === 'vault') {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(doorX + doorW / 2, h - doorH / 2 - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else px(ctx, doorX + doorW - 4, h - doorH / 2 - 2, 2, 2, '#ffd23f');
  }

  // sign plate with name
  const label = b.label.toUpperCase();
  const tw = textWidth(label);
  const sw = Math.min(w - 4, tw + 8);
  const sx = Math.round(w / 2 - sw / 2);
  const sy = wy - 5;
  box(ctx, sx, sy, sw, 9, b.locked ? '#9a8bb0' : '#fffaf0');
  drawText(ctx, label, sx + 4, sy + 2, INK);

  if (b.locked) {
    // boards across the door
    px(ctx, doorX - 2, h - doorH + 2, doorW + 4, 2, '#b07a4a');
    px(ctx, doorX - 2, h - doorH + 8, doorW + 4, 2, '#b07a4a');
    // dim
    ctx.fillStyle = 'rgba(43,29,58,0.28)';
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}
