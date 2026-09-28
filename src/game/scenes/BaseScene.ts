import Phaser from 'phaser';
import { NPCS, type NpcId } from '../../core/characters';
import { prefersReducedMotion } from '../../core/settings';
import { bus } from '../bus';
import { PlayerController } from '../player';

/** In-game clock: 12 real minutes per day, starting mid-morning. */
const START_HOUR = 9;
const MS_PER_HOUR = 30_000;
let clockOffset = 0; // survives scene switches

export function gameHour(timeMs: number) {
  return (START_HOUR + (timeMs + clockOffset) / MS_PER_HOUR) % 24;
}

export abstract class BaseScene extends Phaser.Scene {
  player!: PlayerController;
  protected night!: Phaser.GameObjects.Rectangle;
  protected glows: Phaser.GameObjects.Image[] = [];
  protected npcSprites = new Map<NpcId, Phaser.Physics.Arcade.Sprite>();
  protected outdoor = true;
  private unsubs: (() => void)[] = [];
  private lastHour = -1;
  private elapsed = 0;

  protected setupCamera(worldW: number, worldH: number) {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    const fit = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      const zoom = Phaser.Math.Clamp(Math.floor(Math.min(w / (16 * 24), h / (16 * 15))), 2, 4);
      cam.setZoom(zoom);
      this.night?.setSize(w, h);
    };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setRoundPixels(true);
  }

  protected setupNight() {
    this.night = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x1b1440, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100000);
  }

  protected addGlow(x: number, y: number) {
    const g = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(99999).setAlpha(0);
    this.glows.push(g);
  }

  protected addNpc(id: NpcId, x: number, y: number, facing: 'down' | 'left' | 'right' | 'up', building: string | null) {
    const s = this.physics.add.sprite(x, y, `npc-${id}`, ['down', 'left', 'right', 'up'].indexOf(facing) * 3);
    s.setOrigin(0.5, 1).setDepth(y).setImmovable(true);
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 6).setOffset(3, 18);
    body.pushable = false;
    this.physics.add.collider(this.player.sprite, s);
    this.npcSprites.set(id, s);
    this.player.interactables.push({ x, y: y - 4, radius: 22, label: `Talk to ${NPCS[id].name.split(' ')[0]}`, action: { kind: 'npc', npc: id, building } });
    // idle: look around now and then
    this.time.addEvent({
      delay: 2500 + Math.random() * 3000,
      loop: true,
      callback: () => {
        if (this.player.paused) return;
        const d = Phaser.Math.Distance.Between(s.x, s.y, this.player.sprite.x, this.player.sprite.y);
        let dir = ['down', 'left', 'right', 'down'][Math.floor(Math.random() * 4)];
        if (d < 40) {
          const dx = this.player.sprite.x - s.x;
          const dy = this.player.sprite.y - s.y;
          dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        }
        s.setFrame(['down', 'left', 'right', 'up'].indexOf(dir) * 3);
      },
    });
    return s;
  }

  protected wireBus() {
    this.unsubs.push(
      bus.on('pause', () => {
        this.player.paused = true;
        this.player.clearPrompt();
      }),
      bus.on('resume', () => {
        this.player.paused = false;
        // don't let the key that closed the overlay re-trigger an interaction
        (this.player as unknown as { lastActionHeld: boolean }).lastActionHeld = true;
        this.onRefresh();
      }),
      bus.on('refresh', () => this.onRefresh()),
    );
    const cleanup = () => {
      bus.emit('prompt', null);
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.glows = [];
      this.npcSprites.clear();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
  }

  /** progress changed: update markers, unlocked doors… */
  protected onRefresh() {}

  update(_time: number, delta: number) {
    if (!this.sys.isActive() || !this.player) return;
    this.player.update(delta);
    if (!this.player.paused) this.elapsed += delta;
    const hour = gameHour(this.elapsed);
    // darkness curve: day 7–18 bright, dusk/dawn ramps, night ~0.55
    let dark = 0;
    if (hour >= 18 && hour < 21) dark = (hour - 18) / 3;
    else if (hour >= 21 || hour < 5) dark = 1;
    else if (hour >= 5 && hour < 7) dark = 1 - (hour - 5) / 2;
    const alpha = this.outdoor ? dark * 0.5 : dark * 0.12;
    if (this.night) {
      this.night.setFillStyle(hour >= 17 && hour < 19.5 ? 0x5a2d6b : 0x1b1440, alpha);
    }
    for (const g of this.glows) g.setAlpha(this.outdoor ? dark * 0.9 : 0);
    const h = Math.floor(hour);
    if (h !== this.lastHour) {
      this.lastHour = h;
      bus.emit('clock', { hour: h });
    }
  }

  protected persistClock() {
    clockOffset += this.elapsed;
    this.elapsed = 0;
  }

  protected reducedMotion() {
    return prefersReducedMotion();
  }
}
