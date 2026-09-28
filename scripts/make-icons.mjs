// Draws the pixel-art RV app icon and writes PNGs (no dependencies).
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcT = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function png(size, px) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const chunk = (t, d) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const G = 32;

function cell(x, y) {
  const sky = y < 20 ? (y < 10 ? '#7cc8ff' : '#bfe7ff') : '#79c85a';
  if (y >= 23 && y <= 25) return '#4b4f58';
  if (x >= 5 && x <= 26 && y >= 9 && y <= 21) {
    if (x === 5 || x === 26 || y === 9 || y === 21) return '#2b1d3a';
    if (y >= 17 && y <= 18) return '#ff7a2f';
    if (y === 19) return '#14b8a6';
    if (x >= 8 && x <= 12 && y >= 11 && y <= 15) return x === 8 || x === 12 || y === 11 || y === 15 ? '#2b1d3a' : '#7fc4ef';
    if (x >= 20 && x <= 23 && y >= 11 && y <= 20) return x === 20 || x === 23 || y === 11 ? '#2b1d3a' : '#8b5cf6';
    return '#f4eee0';
  }
  if (((x >= 8 && x <= 11) || (x >= 19 && x <= 22)) && y >= 21 && y <= 24) return x === 8 || x === 11 || x === 19 || x === 22 ? '#2b1d3a' : '#555a64';
  if (x >= 13 && x <= 18 && y >= 4 && y <= 7) return '#ffd23f';
  return sky;
}

for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0],
]) {
  const inner = size * (1 - pad * 2);
  writeFileSync(
    `public/icons/${name}`,
    png(size, (x, y) => {
      const gx = Math.floor(((x - size * pad) / inner) * G);
      const gy = Math.floor(((y - size * pad) / inner) * G);
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) return hex('#7cc8ff');
      return hex(cell(gx, gy));
    }),
  );
}
console.log('icons written');
