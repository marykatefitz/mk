import Phaser from 'phaser';
import { bus, virtualInput, type Interaction } from './bus';
import type { Dir } from './sprites/characters';
import { sfx } from '../core/audio/sfx';

export interface Interactable {
  x: number;
  y: number;
  radius: number;
  label: string;
  action: Interaction | (() => void);
}

export class PlayerController {
  sprite: Phaser.Physics.Arcade.Sprite;
  facing: Dir = 'down';
  paused = false;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private lastPrompt: string | null = null;
  private lastActionHeld = false;
  private stepTimer = 0;
  interactables: Interactable[] = [];

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setOrigin(0.5, 1);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 6);
    body.setOffset(3, 18);
    this.sprite.setCollideWorldBounds(true);
    const kb = scene.input.keyboard!;
    const k = (code: number) => kb.addKey(code, false);
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: k(K.UP), down: k(K.DOWN), left: k(K.LEFT), right: k(K.RIGHT),
      w: k(K.W), a: k(K.A), s: k(K.S), d: k(K.D),
      e: k(K.E), space: k(K.SPACE), enter: k(K.ENTER), shift: k(K.SHIFT),
    };
  }

  face(dir: Dir) {
    this.facing = dir;
    this.sprite.anims.stop();
    this.sprite.setFrame(['down', 'left', 'right', 'up'].indexOf(dir) * 3);
  }

  update(delta: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body || !this.sprite.active) return;
    if (this.paused) {
      body.setVelocity(0, 0);
      this.sprite.anims.stop();
      return;
    }
    const K = this.keys;
    let dx = 0;
    let dy = 0;
    if (K.left.isDown || K.a.isDown) dx -= 1;
    if (K.right.isDown || K.d.isDown) dx += 1;
    if (K.up.isDown || K.w.isDown) dy -= 1;
    if (K.down.isDown || K.s.isDown) dy += 1;
    dx += virtualInput.x;
    dy += virtualInput.y;
    let action = K.e.isDown || K.space.isDown || K.enter.isDown || virtualInput.action;
    let run = K.shift.isDown || virtualInput.run;

    // Gamepad
    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      const ax = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      if (Math.abs(ax) > 0.25) dx += ax;
      if (Math.abs(ay) > 0.25) dy += ay;
      if (pad.left) dx -= 1;
      if (pad.right) dx += 1;
      if (pad.up) dy -= 1;
      if (pad.down) dy += 1;
      if (pad.A) action = true;
      if (pad.B) run = true;
    }

    const len = Math.hypot(dx, dy);
    const speed = run ? 135 : 85;
    if (len > 0.1) {
      const nx = dx / Math.max(1, len);
      const ny = dy / Math.max(1, len);
      body.setVelocity(nx * speed, ny * speed);
      const dir: Dir = Math.abs(nx) > Math.abs(ny) ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
      this.facing = dir;
      this.sprite.anims.play(`player-walk-${dir}`, true);
      this.sprite.anims.timeScale = run ? 1.6 : 1;
      this.stepTimer += delta;
      if (this.stepTimer > (run ? 220 : 320)) {
        this.stepTimer = 0;
        sfx('step');
      }
    } else {
      body.setVelocity(0, 0);
      if (this.sprite.anims.isPlaying) this.face(this.facing);
    }
    this.sprite.setDepth(this.sprite.y);

    // Interactions
    const probe = { down: [0, 6], up: [0, -10], left: [-8, -2], right: [8, -2] }[this.facing];
    const px = this.sprite.x + probe[0];
    const py = this.sprite.y + probe[1];
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - px, it.y - py);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    const label = best?.label ?? null;
    if (label !== this.lastPrompt) {
      this.lastPrompt = label;
      bus.emit('prompt', label ? { label } : null);
    }
    if (action && !this.lastActionHeld && best) {
      sfx('select');
      if (typeof best.action === 'function') best.action();
      else bus.emit('interact', best.action);
    }
    this.lastActionHeld = action;
  }

  clearPrompt() {
    this.lastPrompt = null;
    bus.emit('prompt', null);
  }
}
