import Phaser from 'phaser';
import { CHALLENGE_BY_ID } from '../../departments/sql';
import { useProgress } from '../../core/progress/store';
import { bossState, challengeState, world, worldState } from '../../core/quests/unlocks';
import { bus } from '../bus';
import { PlayerController } from '../player';
import { INK, box, hash2, makeCanvas, px, shade } from '../sprites/draw';
import { BUILDING_BY_ID, type BuildingDef } from '../world/buildings';
import { TILE } from '../world/campus';
import { BaseScene } from './BaseScene';

const ROOM_W = 20;
const ROOM_H = 15;
const DESK_X = [3, 6.5, 10, 13.5, 17];
const DESK_Y = [7.2, 10.6];

type Floor = 'wood' | 'carpet' | 'tile' | 'concrete';

const FLOOR: Record<string, Floor> = { lot: 'wood', showroom: 'tile', service: 'concrete', fi: 'carpet', vault: 'tile', data: 'carpet', hr: 'wood', hq: 'carpet' };

function paintRoom(b: BuildingDef): HTMLCanvasElement {
  const W = ROOM_W * TILE;
  const H = ROOM_H * TILE;
  const [c, ctx] = makeCanvas(W, H);
  const floor = FLOOR[b.id] ?? 'wood';
  for (let ty = 3; ty < ROOM_H; ty++) {
    for (let tx = 0; tx < ROOM_W; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      const r = hash2(tx, ty, 5);
      if (floor === 'wood') {
        px(ctx, x, y, TILE, TILE, r > 0.5 ? '#c99264' : '#c28a5c');
        px(ctx, x, y + 7, TILE, 1, '#a8744a');
        px(ctx, x + ((ty % 2) * 8), y, 1, 7, '#a8744a');
        px(ctx, x + ((ty % 2) * 8 + 4) % 16, y + 8, 1, 8, '#a8744a');
      } else if (floor === 'carpet') {
        const base = b.id === 'fi' ? '#5b3a4e' : b.id === 'hq' ? '#34406b' : '#3f5a4a';
        px(ctx, x, y, TILE, TILE, (tx + ty) % 2 ? base : shade(base, 0.04));
        if (r > 0.7) px(ctx, x + 5, y + 9, 1, 1, shade(base, 0.12));
      } else if (floor === 'tile') {
        px(ctx, x, y, TILE, TILE, (tx + ty) % 2 ? '#eeeae0' : '#dcd6c8');
        px(ctx, x, y, TILE, 1, '#c9c2b2');
        px(ctx, x, y, 1, TILE, '#c9c2b2');
      } else {
        px(ctx, x, y, TILE, TILE, '#9aa1ab');
        if (r > 0.8) px(ctx, x + Math.floor(r * 12), y + 4, 3, 2, '#8a919b');
        if (ty === 9) px(ctx, x, y + 6, TILE, 2, '#ffd23f');
      }
    }
  }
  // back wall
  const wall = shade(b.wall, -0.05);
  px(ctx, 0, 0, W, 3 * TILE, wall);
  px(ctx, 0, 3 * TILE - 4, W, 4, shade(b.wall, -0.3));
  px(ctx, 0, 0, W, 3, INK);
  // windows
  for (const wx of [1.5, 7, 12.5, 17]) {
    box(ctx, wx * TILE, 8, 28, 22, '#7fc4ef');
    px(ctx, wx * TILE + 3, 11, 6, 2, '#d7f0ff');
    px(ctx, wx * TILE + 13, 9, 2, 20, INK);
  }
  // whiteboard
  box(ctx, 8.2 * TILE, 6, 30, 18, '#ffffff');
  px(ctx, 8.2 * TILE + 4, 12, 16, 1, '#3b82f6');
  px(ctx, 8.2 * TILE + 4, 16, 10, 1, '#e0473b');
  // side walls
  px(ctx, 0, 0, 3, H, INK);
  px(ctx, W - 3, 0, 3, H, INK);
  px(ctx, 0, H - 3, W, 3, INK);
  return c;
}

export class InteriorScene extends BaseScene {
  private building!: BuildingDef;
  private markers: { img: Phaser.GameObjects.Image; state: () => string }[] = [];

  constructor() {
    super('interior');
  }

  create(data: { building: string }) {
    this.outdoor = false;
    this.markers = [];
    this.building = BUILDING_BY_ID[data.building];
    const b = this.building;
    const W = ROOM_W * TILE;
    const H = ROOM_H * TILE;
    const roomKey = `room-${b.id}`;
    if (!this.textures.exists(roomKey)) this.textures.addCanvas(roomKey, paintRoom(b));
    this.add.image(0, 0, roomKey).setOrigin(0, 0).setDepth(-10000);
    this.cameras.main.setBackgroundColor('#1b1428');

    this.player = new PlayerController(this, W / 2, H - 20);
    this.player.face('up');
    const statics = this.physics.add.staticGroup();
    const solid = (x: number, y: number, w: number, h: number) => statics.add(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0));
    solid(0, 0, W, 3 * TILE + 2); // back wall
    solid(0, 0, 4, H);
    solid(W - 4, 0, 4, H);
    solid(0, H - 2, W / 2 - 14, 2);
    solid(W / 2 + 14, H - 2, W / 2 - 14, 2);

    // exit
    this.add.image(W / 2, H + 2, 'door-exit').setOrigin(0.5, 1).setDepth(H + 10);
    this.player.interactables.push({ x: W / 2, y: H - 6, radius: 18, label: 'Leave', action: { kind: 'exit' } });

    // decorations
    this.add.image(22, 3 * TILE + 20, 'plant').setOrigin(0.5, 1).setDepth(3 * TILE + 20);
    this.add.image(W - 22, 3 * TILE + 20, 'plant').setOrigin(0.5, 1).setDepth(3 * TILE + 20);
    this.add.image(14, 9 * TILE, 'coffee').setOrigin(0.5, 1).setDepth(9 * TILE);
    solid(6, 3 * TILE, 12, 20);
    solid(W - 18, 3 * TILE, 12, 20);
    solid(6, 9 * TILE - 14, 16, 14);

    const save = useProgress.getState().save!;
    const wid = b.world!;
    const w = world(wid);
    const state = worldState(save, wid);

    if (wid === 8) {
      // GM conference room
      const tx = W / 2;
      const ty = 9 * TILE;
      const table = this.add.rectangle(tx, ty, 9 * TILE, 3 * TILE, 0x8a5a36).setStrokeStyle(2, 0x2b1d3a).setDepth(ty + 20);
      solid(tx - 4.5 * TILE, ty - 1.5 * TILE, 9 * TILE, 3 * TILE);
      void table;
      this.add.image(W / 2, 3 * TILE + 2, 'door-final').setOrigin(0.5, 1).setDepth(3 * TILE);
      this.addMarker(W / 2, 3 * TILE - 34, () => (state === 'open' ? 'boss' : state === 'cleared' ? 'solved' : 'locked'));
      this.player.interactables.push({ x: W / 2, y: 3 * TILE + 8, radius: 20, label: 'The Monthly Ops Review', action: { kind: 'boss-door', building: b.id, boss: 'boss' } });
      this.addNpc('rhonda', 15 * TILE, 5 * TILE, 'down', b.id);
    } else if (w) {
      // terminals
      w.challenges.forEach((cid, i) => {
        const x = DESK_X[i % 5] * TILE;
        const y = DESK_Y[Math.floor(i / 5)] * TILE;
        const desk = this.add.image(x, y, 'desk').setOrigin(0.5, 1).setDepth(y);
        solid(x - 12, y - 10, 24, 10);
        this.addMarker(x, y - 26, () => challengeState(useProgress.getState().save!, w, i), desk);
        const ch = CHALLENGE_BY_ID[cid];
        this.player.interactables.push({ x, y: y + 6, radius: 16, label: `Terminal ${i + 1}: ${ch.title}`, action: { kind: 'desk', building: b.id, challengeId: cid } });
      });
      // boss doors
      this.add.image(4 * TILE, 3 * TILE + 2, 'door-mini').setOrigin(0.5, 1).setDepth(3 * TILE);
      this.add.image(W / 2, 3 * TILE + 2, 'door-boss').setOrigin(0.5, 1).setDepth(3 * TILE);
      this.addMarker(4 * TILE, 3 * TILE - 30, () => mapBoss(bossState(useProgress.getState().save!, w, 'mini')));
      this.addMarker(W / 2, 3 * TILE - 34, () => mapBoss(bossState(useProgress.getState().save!, w, 'boss')));
      this.player.interactables.push({ x: 4 * TILE, y: 3 * TILE + 8, radius: 18, label: `Mini-boss: ${w.miniBoss.name}`, action: { kind: 'boss-door', building: b.id, boss: 'mini' } });
      this.player.interactables.push({ x: W / 2, y: 3 * TILE + 8, radius: 20, label: `BOSS: ${w.boss.name}`, action: { kind: 'boss-door', building: b.id, boss: 'boss' } });
      if (b.npc) this.addNpc(b.npc, 16 * TILE, 4.6 * TILE, 'down', b.id);
      if (b.id === 'service') this.addNpc('earl', 3 * TILE, 13 * TILE, 'right', b.id);
      if (b.id === 'lot') this.addNpc('scout', 17 * TILE, 13 * TILE, 'left', b.id);
    } else {
      // department not built yet
      if (b.npc) this.addNpc(b.npc, W / 2, 7 * TILE, 'down', b.id);
      const sign = this.add.text(W / 2, 10 * TILE, '🚧 UNDER CONSTRUCTION 🚧', { fontFamily: 'Silkscreen', fontSize: '10px', color: '#2b1d3a', backgroundColor: '#ffd23f', padding: { x: 4, y: 2 } });
      sign.setOrigin(0.5).setDepth(10 * TILE).setResolution(4);
    }

    this.physics.add.collider(this.player.sprite, statics);
    this.setupNight();
    this.setupCamera(W, H + 8);
    this.cameras.main.setBounds(-40, -20, W + 80, H + 40);
    this.wireBus();
    this.events.once('shutdown', () => this.persistClock());
    bus.emit('scene', { scene: 'interior', building: b.id });
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private addMarker(x: number, y: number, state: () => string, desk?: Phaser.GameObjects.Image) {
    const img = this.add.image(x, y, `marker-${state()}`).setOrigin(0.5, 1).setDepth(100000 - 1);
    if (!this.reducedMotion()) this.tweens.add({ targets: img, y: y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.markers.push({
      img,
      state: () => {
        const s = state();
        if (desk) desk.setTexture(s === 'locked' ? 'desk-off' : 'desk');
        return s;
      },
    });
    if (desk) desk.setTexture(state() === 'locked' ? 'desk-off' : 'desk');
  }

  protected onRefresh() {
    for (const m of this.markers) m.img.setTexture(`marker-${m.state()}`);
  }
}

function mapBoss(s: string) {
  return s === 'available' ? 'boss' : s === 'beaten' ? 'solved' : 'locked';
}
