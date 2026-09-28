import type Phaser from 'phaser';
import { NPCS, type NpcId } from '../core/characters';
import { useProgress } from '../core/progress/store';
import { worldState } from '../core/quests/unlocks';
import { buildingCanvas } from './sprites/buildings';
import { DIRS, FRAME_H, FRAME_W, characterSheet, type CharLook } from './sprites/characters';
import { INK, box, drawText, makeCanvas, px } from './sprites/draw';
import {
  RV_STRIPES,
  benchCanvas,
  bushCanvas,
  coffeeCanvas,
  coneCanvas,
  deskCanvas,
  doorCanvas,
  flagCanvas,
  glowCanvas,
  lampCanvas,
  liftCanvas,
  markerCanvas,
  plantCanvas,
  rvCanvas,
  tentCanvas,
  treeCanvas,
  type RvKind,
} from './sprites/props';
import { BUILDINGS, type BuildingDef } from './world/buildings';
import { TILE, paintGround } from './world/campus';

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas)!;
}

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number) {
  const tex = addCanvas(scene, key, canvas);
  const cols = Math.floor(canvas.width / fw);
  const rows = Math.floor(canvas.height / fh);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(i++, 0, c * fw, r * fh, fw, fh);
  return tex;
}

export function registerCharacter(scene: Phaser.Scene, key: string, look: CharLook) {
  addSheet(scene, key, characterSheet(look), FRAME_W, FRAME_H);
  DIRS.forEach((dir, row) => {
    const animKey = `${key}-walk-${dir}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: [1, 0, 2, 0].map((f) => ({ key, frame: row * 3 + f })),
      frameRate: 8,
      repeat: -1,
    });
  });
}

export function npcLook(id: NpcId): CharLook {
  const l = NPCS[id].look;
  return { ...l, pants: id === 'earl' ? '#3b4a6b' : '#2b2f45' };
}

export function buildingLocked(b: BuildingDef): boolean {
  if (!b.world) return true;
  const save = useProgress.getState().save;
  if (!save) return true;
  return worldState(save, b.world) === 'locked';
}

export function registerBuilding(scene: Phaser.Scene, b: BuildingDef) {
  addCanvas(
    scene,
    `bld-${b.id}`,
    buildingCanvas({
      w: b.w * TILE,
      h: b.h * TILE,
      wall: b.wall,
      roof: b.roof,
      trim: b.trim,
      style: b.style,
      label: b.name,
      locked: buildingLocked(b),
    }),
  );
}

function arcadeCanvas() {
  const [c, ctx] = makeCanvas(56, 34);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(3, 28, 52, 6);
  box(ctx, 0, 6, 54, 24, '#f4eee0');
  px(ctx, 1, 18, 52, 3, '#ff7a2f');
  px(ctx, 1, 21, 52, 2, '#14b8a6');
  box(ctx, 4, 9, 10, 7, '#7fc4ef');
  box(ctx, 40, 9, 10, 7, '#7fc4ef');
  box(ctx, 22, 12, 10, 16, '#8b5cf6');
  px(ctx, 29, 20, 2, 2, '#ffd23f');
  box(ctx, 8, 0, 38, 8, '#2b1d3a');
  drawText(ctx, 'ARCADE', 15, 2, '#ffd23f');
  px(ctx, 6, 28, 6, 4, INK);
  px(ctx, 42, 28, 6, 4, INK);
  return c;
}

/** Everything the scenes need. Cheap enough to redo when the player look changes. */
export function registerAllTextures(scene: Phaser.Scene) {
  addCanvas(scene, 'ground', paintGround());
  for (const b of BUILDINGS) registerBuilding(scene, b);
  for (let i = 0; i < 3; i++) addCanvas(scene, `tree${i}`, treeCanvas(i));
  addCanvas(scene, 'bush', bushCanvas());
  addCanvas(scene, 'lamp', lampCanvas());
  addCanvas(scene, 'glow', glowCanvas(46));
  addCanvas(scene, 'bench', benchCanvas());
  addCanvas(scene, 'cone', coneCanvas());
  addCanvas(scene, 'plant', plantCanvas());
  addCanvas(scene, 'coffee', coffeeCanvas());
  addCanvas(scene, 'arcade', arcadeCanvas());
  addSheet(scene, 'flag', flagCanvas(), 20, 40);
  addSheet(scene, 'lift', liftCanvas(), 28, 24);
  for (const t of ['#ff7a2f', '#14b8a6', '#3b82f6']) addCanvas(scene, `tent-${t}`, tentCanvas(t));
  const kinds: RvKind[] = ['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler'];
  kinds.forEach((k) => RV_STRIPES.forEach((s, i) => addCanvas(scene, `rv-${k}-${i}`, rvCanvas(k, s))));
  addCanvas(scene, 'desk', deskCanvas('#3fe0c5'));
  addCanvas(scene, 'desk-off', deskCanvas('#1f2937'));
  (['available', 'solved', 'locked', 'boss'] as const).forEach((m) => addCanvas(scene, `marker-${m}`, markerCanvas(m)));
  addCanvas(scene, 'door-exit', doorCanvas('#6b4430', 20, 22, 'EXIT'));
  addCanvas(scene, 'door-boss', doorCanvas('#e0473b', 28, 30, 'BOSS'));
  addCanvas(scene, 'door-mini', doorCanvas('#ff7a2f', 24, 26, 'MINI'));
  addCanvas(scene, 'door-final', doorCanvas('#2f4b8f', 30, 30, 'REVIEW'));
  for (const id of Object.keys(NPCS) as NpcId[]) registerCharacter(scene, `npc-${id}`, npcLook(id));
  registerPlayer(scene);
}

export function registerPlayer(scene: Phaser.Scene) {
  const save = useProgress.getState().save;
  const look = save?.player.look ?? { skin: '#e0ac69', hair: '#3b2418', hairStyle: 'short', shirt: '#14b8a6', pants: '#2b1d3a' };
  registerCharacter(scene, 'player', { ...look, accent: '#ffd23f' });
}
