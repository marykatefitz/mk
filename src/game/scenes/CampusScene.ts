import Phaser from 'phaser';
import { useProgress } from '../../core/progress/store';
import { arcadeUnlocked } from '../../core/quests/unlocks';
import { isRvShowWeekend } from '../../core/events';
import { bus } from '../bus';
import { PlayerController } from '../player';
import { RV_SIZE, type RvKind } from '../sprites/props';
import { buildingLocked, registerBuilding } from '../textures';
import { BUILDINGS } from '../world/buildings';
import {
  ARCADE_POS,
  MAP_H,
  MAP_W,
  OUTDOOR_NPCS,
  PLAYER_SPAWN,
  TILE,
  parkedRvs,
  propPlacements,
} from '../world/campus';
import { BaseScene } from './BaseScene';

export class CampusScene extends BaseScene {
  private buildingImages = new Map<string, Phaser.GameObjects.Image>();
  private statics!: Phaser.Physics.Arcade.StaticGroup;

  constructor() {
    super('campus');
  }

  create(data: { from?: string }) {
    this.outdoor = true;
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    this.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-10000);
    this.statics = this.physics.add.staticGroup();

    // spawn: at a building door if returning from one
    const save = useProgress.getState().save;
    let spawn = PLAYER_SPAWN;
    const fromB = data?.from ? BUILDINGS.find((b) => b.id === data.from) : undefined;
    if (fromB) spawn = { x: (fromB.x + fromB.w / 2) * TILE, y: (fromB.y + fromB.h) * TILE + 18 };
    else if (save?.position) spawn = { x: save.position.x, y: save.position.y };
    this.player = new PlayerController(this, spawn.x, spawn.y);
    if (fromB) this.player.face('down');

    // buildings
    for (const b of BUILDINGS) {
      const img = this.add.image(b.x * TILE, b.y * TILE, `bld-${b.id}`).setOrigin(0, 0).setDepth((b.y + b.h) * TILE);
      this.buildingImages.set(b.id, img);
      this.solid(b.x * TILE + 2, b.y * TILE + 8, b.w * TILE - 4, b.h * TILE - 10);
      const door = { x: (b.x + b.w / 2) * TILE, y: (b.y + b.h) * TILE + 4 };
      this.player.interactables.push({
        x: door.x,
        y: door.y,
        radius: 20,
        label: '',
        action: () => {
          if (b.comingSoon) bus.emit('interact', { kind: 'sign', title: `${b.name}: coming soon`, text: b.comingSoon });
          else if (buildingLocked(b)) bus.emit('interact', { kind: 'sign', title: `${b.name} is locked`, text: 'Finish the previous department first. Check your objective (top left).' });
          else bus.emit('interact', { kind: 'building', building: b.id });
        },
      });
      this.updateDoorLabel(b.id);
    }

    // props
    for (const p of propPlacements()) {
      const img = this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setDepth(p.y);
      if (p.key === 'lamp') this.addGlow(p.x, p.y - 26);
      if (p.collide) this.solid(p.x - p.collide.w / 2, p.y - p.collide.h, p.collide.w, p.collide.h);
      void img;
    }

    // parked RVs on the lot
    for (const rv of parkedRvs()) {
      this.add.image(rv.x, rv.y, `rv-${rv.kind}-${rv.stripe}`).setOrigin(0.5, 1).setDepth(rv.y);
      const [w, h] = RV_SIZE[rv.kind];
      this.solid(rv.x - w / 2, rv.y - h + 4, w, h - 4);
    }

    // flag in front of the showroom
    if (!this.anims.exists('flag-wave')) this.anims.create({ key: 'flag-wave', frames: this.anims.generateFrameNumbers('flag', { start: 0, end: 2 }), frameRate: 5, repeat: -1 });
    const flag = this.add.sprite(45 * TILE + 8, 14 * TILE + 8, 'flag').setOrigin(0.5, 1).setDepth(14 * TILE + 8);
    if (!this.reducedMotion()) flag.play('flag-wave');
    this.solid(45 * TILE + 5, 14 * TILE + 4, 6, 4);

    // service lifts with a tech working
    for (let i = 0; i < 2; i++) {
      const lx = (62 + i * 5) * TILE;
      const ly = 16 * TILE + 14;
      const lift = this.add.sprite(lx, ly, 'lift', 0).setOrigin(0.5, 1).setDepth(ly);
      const rv = this.add.image(lx, ly - 6, `rv-${i ? 'Class C' : 'Travel Trailer'}-${i + 2}`).setOrigin(0.5, 1).setDepth(ly - 1).setAngle(90).setScale(0.8);
      if (!this.reducedMotion())
        this.time.addEvent({
          delay: 2600 + i * 700,
          loop: true,
          callback: () => {
            const up = lift.frame.name === '0';
            lift.setFrame(up ? 1 : 0);
            rv.y = ly - 6 - (up ? 4 : 0);
          },
        });
      this.solid(lx - 14, ly - 10, 28, 8);
    }

    // arcade trailer
    const arcade = this.add.image(ARCADE_POS.x, ARCADE_POS.y, 'arcade').setOrigin(0.5, 1).setDepth(ARCADE_POS.y);
    this.solid(ARCADE_POS.x - 27, ARCADE_POS.y - 26, 54, 24);
    this.player.interactables.push({
      x: ARCADE_POS.x,
      y: ARCADE_POS.y + 4,
      radius: 22,
      label: 'Play in the Arcade',
      action: () => {
        const s = useProgress.getState().save;
        if (s && arcadeUnlocked(s)) bus.emit('interact', { kind: 'arcade' });
        else bus.emit('interact', { kind: 'sign', title: 'Arcade Trailer', text: 'Closed for now. Beat the Stock Number Shuffler (World 1 mini-boss) to open the arcade!' });
      },
    });
    void arcade;

    // NPCs
    for (const n of OUTDOOR_NPCS) this.addNpc(n.npc, n.x, n.y, n.facing, null);

    // RV Show weekend tents
    if (isRvShowWeekend(new Date())) {
      const colors = ['#ff7a2f', '#14b8a6', '#3b82f6'];
      [8, 18, 28, 38].forEach((tx, i) => {
        const y = 23 * TILE + 8;
        this.add.image(tx * TILE, y, `tent-${colors[i % 3]}`).setOrigin(0.5, 1).setDepth(y);
        this.solid(tx * TILE - 18, y - 12, 36, 10);
      });
    }

    // physics
    this.physics.add.collider(this.player.sprite, this.statics);
    this.setupNight();
    this.setupCamera(W, H);
    this.wireBus();
    this.startTraffic();

    this.events.once('shutdown', () => this.persistClock());
    bus.emit('scene', { scene: 'campus', building: null });
    this.cameras.main.fadeIn(250, 0, 0, 0);

    // remember position occasionally
    this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => {
        const p = this.player.sprite;
        useProgress.getState().update((s) => {
          s.position = { x: Math.round(p.x), y: Math.round(p.y), facing: this.player.facing };
        });
      },
    });
  }

  private solid(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xff0000, 0);
    this.statics.add(r);
  }

  private updateDoorLabel(id: string) {
    const b = BUILDINGS.find((x) => x.id === id)!;
    const it = this.player.interactables.find((i) => Math.abs(i.x - (b.x + b.w / 2) * TILE) < 1 && Math.abs(i.y - ((b.y + b.h) * TILE + 4)) < 1);
    if (!it) return;
    it.label = b.comingSoon ? `${b.name} (coming soon)` : buildingLocked(b) ? `${b.name} (locked)` : `Enter ${b.name}`;
  }

  protected onRefresh() {
    // re-paint buildings whose lock state may have changed
    for (const b of BUILDINGS) {
      if (b.comingSoon) continue;
      registerBuilding(this, b);
      this.buildingImages.get(b.id)?.setTexture(`bld-${b.id}`);
      this.updateDoorLabel(b.id);
    }
  }

  private startTraffic() {
    const kinds: RvKind[] = ['Class A', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Class B'];
    const spawn = () => {
      if (!this.scene.isActive()) return;
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const ltr = Math.random() < 0.5;
      const y = ltr ? 3.5 * TILE : 2 * TILE;
      const x0 = ltr ? -60 : MAP_W * TILE + 60;
      const rv = this.add.image(x0, y, `rv-${kind}-${Math.floor(Math.random() * 8)}`).setAngle(ltr ? 90 : -90).setDepth(y + 10);
      this.tweens.add({
        targets: rv,
        x: ltr ? MAP_W * TILE + 60 : -60,
        duration: 9000 + Math.random() * 4000,
        onComplete: () => rv.destroy(),
      });
      this.time.delayedCall(6000 + Math.random() * 9000, spawn);
    };
    if (!this.reducedMotion()) this.time.delayedCall(1500, spawn);
  }
}
