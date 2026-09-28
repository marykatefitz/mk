// Procedural props: RVs, trees, lamps, desks, markers, doors, etc.

import { INK, box, drawText, makeCanvas, px, shade, textWidth } from './draw';

export type RvKind = 'Class A' | 'Class B' | 'Class C' | 'Travel Trailer' | 'Fifth Wheel' | 'Toy Hauler';

export const RV_SIZE: Record<RvKind, [number, number]> = {
  'Class A': [16, 44],
  'Class B': [12, 28],
  'Class C': [15, 36],
  'Travel Trailer': [15, 38],
  'Fifth Wheel': [16, 44],
  'Toy Hauler': [16, 40],
};

export const RV_STRIPES = ['#ff7a2f', '#14b8a6', '#3b82f6', '#8b5cf6', '#e0473b', '#22914b', '#d9a900', '#6b4430'];

/** Top-down RV, front facing up. */
export function rvCanvas(kind: RvKind, stripe: string) {
  const [w, h] = RV_SIZE[kind];
  const [c, ctx] = makeCanvas(w + 2, h + 3);
  const body = '#f4eee0';
  const bodyD = '#d8d0bf';
  const motor = kind.startsWith('Class');
  let top = 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(2, 3, w, h);
  if (!motor) {
    // hitch / pin box
    const hitchLen = kind === 'Fifth Wheel' ? 8 : 5;
    px(ctx, w / 2 - 1, 0, 3, hitchLen, INK);
    px(ctx, w / 2, 1, 1, hitchLen - 1, '#7a7a7a');
    top = hitchLen - 1;
    if (kind === 'Fifth Wheel') {
      box(ctx, 2, top - 2, w - 4, 8, body);
    }
  }
  box(ctx, 0, top, w, h - top, body);
  // roof seams
  for (let y = top + 6; y < h - 4; y += 7) px(ctx, 2, y, w - 4, 1, bodyD);
  // stripe down one side (door side)
  px(ctx, w - 4, top + 3, 2, h - top - 6, stripe);
  px(ctx, 2, top + 3, 1, h - top - 6, shade(stripe, 0.15));
  // AC unit(s)
  box(ctx, Math.floor(w / 2) - 3, top + Math.floor((h - top) * 0.35), 7, 6, '#b8c2cc');
  if (h > 38) box(ctx, Math.floor(w / 2) - 3, top + Math.floor((h - top) * 0.65), 7, 6, '#b8c2cc');
  // vents / skylight
  px(ctx, 3, top + Math.floor((h - top) * 0.55), 3, 3, '#8fa3b8');
  if (motor) {
    // windshield + hood
    const cabH = kind === 'Class A' ? 5 : kind === 'Class B' ? 7 : 8;
    px(ctx, 1, top + 1, w - 2, cabH, kind === 'Class A' ? '#2d3f66' : '#cfd6dd');
    px(ctx, 2, top + 2, w - 4, 3, '#5a86c4');
    px(ctx, 2, top + 2, 2, 1, '#bfe0ff');
    if (kind === 'Class C') {
      // cab-over bunk
      box(ctx, 1, top + 8, w - 2, 6, body);
    }
    if (kind === 'Class B') px(ctx, 1, top + cabH + 1, w - 2, 1, stripe);
  }
  if (kind === 'Toy Hauler') {
    // rear ramp door
    px(ctx, 1, h - 6, w - 2, 5, '#4b4f58');
    for (let x = 2; x < w - 2; x += 2) px(ctx, x, h - 5, 1, 3, '#6b7280');
  }
  // rear bumper
  px(ctx, 1, h - 1, w - 2, 1, '#555');
  return c;
}

export function treeCanvas(variant: number) {
  const [c, ctx] = makeCanvas(24, 32);
  const greens = [
    ['#2f8f4e', '#3fae5f', '#236b3b'],
    ['#3a8a3a', '#56b24a', '#2a6a2a'],
    ['#2b7a5f', '#3fa07c', '#1f5c47'],
  ][variant % 3];
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(12, 29, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, 10, 20, 4, 10, INK);
  px(ctx, 11, 20, 2, 9, '#7a4a2a');
  const blob = (x: number, y: number, r: number, col: string) => {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(12, 13, 10, greens[2]);
  blob(12, 11, 9, greens[0]);
  blob(9, 9, 4, greens[1]);
  blob(15, 13, 3, greens[1]);
  // pixelate the circles
  const img = ctx.getImageData(0, 0, 24, 32);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 100 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  return c;
}

export function bushCanvas() {
  const [c, ctx] = makeCanvas(16, 12);
  box(ctx, 1, 2, 14, 9, '#3fae5f');
  px(ctx, 3, 3, 4, 2, '#6fd07f');
  px(ctx, 9, 5, 3, 2, '#6fd07f');
  px(ctx, 2, 9, 12, 1, '#236b3b');
  return c;
}

export function lampCanvas() {
  const [c, ctx] = makeCanvas(8, 32);
  px(ctx, 3, 6, 2, 26, INK);
  px(ctx, 1, 29, 6, 3, INK);
  box(ctx, 0, 2, 8, 5, '#ffe9a8');
  px(ctx, 1, 0, 6, 2, INK);
  return c;
}

export function glowCanvas(r = 40, color = '255,220,140') {
  const [c, ctx] = makeCanvas(r * 2, r * 2);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${color},0.55)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}

export function flagCanvas() {
  // 3 frames, 20×40 each
  const [c, ctx] = makeCanvas(60, 40);
  for (let f = 0; f < 3; f++) {
    const ox = f * 20;
    px(ctx, ox + 2, 2, 2, 38, INK);
    px(ctx, ox + 1, 0, 4, 2, '#ffd23f');
    for (let y = 0; y < 10; y++) {
      const wave = Math.round(Math.sin((y + f * 2) * 0.9));
      const col = y < 3 ? '#2f4b8f' : y % 2 ? '#ffffff' : '#ff7a2f';
      px(ctx, ox + 4, 3 + y + wave * 0, 14 + wave, 1, col);
    }
    px(ctx, ox + 4, 2, 15, 1, INK);
    px(ctx, ox + 4, 13, 15, 1, INK);
  }
  return c;
}

export function deskCanvas(screen: string) {
  const [c, ctx] = makeCanvas(24, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(2, 18, 22, 4);
  // desk
  box(ctx, 0, 10, 24, 10, '#b07a4a');
  px(ctx, 1, 11, 22, 2, '#c99264');
  px(ctx, 2, 19, 3, 3, INK);
  px(ctx, 19, 19, 3, 3, INK);
  // monitor
  box(ctx, 5, 0, 14, 11, '#3b3f4a');
  px(ctx, 6, 1, 12, 8, screen);
  px(ctx, 7, 2, 5, 1, '#ffffff88');
  px(ctx, 11, 11, 2, 1, INK);
  // keyboard
  px(ctx, 6, 13, 12, 3, INK);
  px(ctx, 7, 14, 10, 1, '#d8d8d8');
  return c;
}

export function markerCanvas(kind: 'available' | 'solved' | 'locked' | 'boss') {
  const [c, ctx] = makeCanvas(12, 14);
  const fill = { available: '#ffd23f', solved: '#37c46b', locked: '#9a8bb0', boss: '#ff4f5e' }[kind];
  box(ctx, 0, 0, 12, 11, fill);
  px(ctx, 4, 11, 4, 1, INK);
  px(ctx, 5, 12, 2, 1, INK);
  if (kind === 'available' || kind === 'boss') {
    px(ctx, 5, 2, 2, 5, INK);
    px(ctx, 5, 8, 2, 1, INK);
  } else if (kind === 'solved') {
    px(ctx, 3, 5, 1, 2, '#fff');
    px(ctx, 4, 6, 1, 2, '#fff');
    px(ctx, 5, 7, 1, 1, '#fff');
    px(ctx, 6, 6, 1, 1, '#fff');
    px(ctx, 7, 5, 1, 1, '#fff');
    px(ctx, 8, 3, 1, 2, '#fff');
  } else {
    px(ctx, 4, 3, 4, 1, INK);
    px(ctx, 3, 4, 1, 2, INK);
    px(ctx, 8, 4, 1, 2, INK);
    px(ctx, 3, 6, 6, 4, INK);
    px(ctx, 5, 7, 2, 2, '#ffd23f');
  }
  return c;
}

export function doorCanvas(color: string, w = 16, h = 20, label?: string) {
  const [c, ctx] = makeCanvas(w, h);
  box(ctx, 0, 0, w, h, color);
  px(ctx, 2, 2, w - 4, h - 3, shade(color, -0.12));
  px(ctx, w - 5, h / 2, 2, 2, '#ffd23f');
  if (label) drawText(ctx, label, Math.round((w - textWidth(label)) / 2), 4, '#ffffff');
  return c;
}

export function signCanvas(text: string, bg = '#fffaf0', fg = INK) {
  const w = Math.max(20, textWidth(text) + 8);
  const [c, ctx] = makeCanvas(w, 20);
  px(ctx, w / 2 - 1, 10, 2, 10, INK);
  box(ctx, 0, 0, w, 11, bg);
  drawText(ctx, text, 4, 3, fg);
  return c;
}

export function tentCanvas(color: string) {
  const [c, ctx] = makeCanvas(40, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(3, 24, 36, 5);
  box(ctx, 2, 10, 36, 16, '#ffffff');
  for (let x = 3; x < 37; x += 6) px(ctx, x, 11, 3, 14, color);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.lineTo(20, 0);
  ctx.lineTo(40, 11);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(3, 10);
  ctx.lineTo(20, 2);
  ctx.lineTo(37, 10);
  ctx.fill();
  return c;
}

export function liftCanvas() {
  // 2 frames (down/up), 28×24
  const [c, ctx] = makeCanvas(56, 24);
  for (let f = 0; f < 2; f++) {
    const ox = f * 28;
    const up = f * 4;
    px(ctx, ox + 1, 2, 3, 22, INK);
    px(ctx, ox + 24, 2, 3, 22, INK);
    px(ctx, ox + 2, 3, 1, 20, '#ffd23f');
    px(ctx, ox + 25, 3, 1, 20, '#ffd23f');
    box(ctx, ox + 3, 14 - up, 22, 3, '#6b7280');
  }
  return c;
}

export function coneCanvas() {
  const [c, ctx] = makeCanvas(8, 10);
  px(ctx, 3, 0, 2, 2, '#ff7a2f');
  px(ctx, 2, 2, 4, 3, '#ff7a2f');
  px(ctx, 2, 4, 4, 1, '#fff');
  px(ctx, 1, 5, 6, 3, '#ff7a2f');
  px(ctx, 0, 8, 8, 2, INK);
  return c;
}

export function benchCanvas() {
  const [c, ctx] = makeCanvas(20, 10);
  box(ctx, 0, 0, 20, 4, '#b07a4a');
  box(ctx, 0, 4, 20, 3, '#9a6a3e');
  px(ctx, 2, 7, 2, 3, INK);
  px(ctx, 16, 7, 2, 3, INK);
  return c;
}

export function plantCanvas() {
  const [c, ctx] = makeCanvas(12, 18);
  box(ctx, 2, 11, 8, 7, '#b86b3a');
  px(ctx, 5, 4, 2, 8, '#236b3b');
  box(ctx, 1, 2, 5, 5, '#3fae5f');
  box(ctx, 6, 0, 5, 6, '#3fae5f');
  box(ctx, 4, 5, 5, 5, '#56b24a');
  return c;
}

export function coffeeCanvas() {
  const [c, ctx] = makeCanvas(14, 22);
  box(ctx, 0, 4, 14, 18, '#3b3f4a');
  px(ctx, 3, 8, 8, 5, '#1a1a1a');
  px(ctx, 5, 14, 4, 4, '#ffffff');
  px(ctx, 2, 6, 3, 1, '#37c46b');
  return c;
}
