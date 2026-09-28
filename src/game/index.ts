import Phaser from 'phaser';
import { bus } from './bus';
import { CampusScene } from './scenes/CampusScene';
import { InteriorScene } from './scenes/InteriorScene';
import { registerAllTextures, registerPlayer } from './textures';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create() {
    registerAllTextures(this);
    this.scene.start('campus', {});
  }
}

export function createGame(parent: HTMLElement): { game: Phaser.Game; destroy: () => void } {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#79c85a',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { gamepad: true, keyboard: { target: window } },
    audio: { noAudio: true },
    fps: { target: 60 },
    scene: [BootScene, CampusScene, InteriorScene],
  });

  const offEnter = bus.on('enterBuilding', ({ building }) => {
    const campus = game.scene.getScene('campus');
    campus.cameras.main.fadeOut(200, 0, 0, 0);
    campus.cameras.main.once('camerafadeoutcomplete', () => {
      game.scene.stop('campus');
      game.scene.start('interior', { building });
    });
  });
  const offExit = bus.on('exitBuilding', () => {
    const interior = game.scene.getScene('interior') as InteriorScene;
    const from = (interior as unknown as { building?: { id: string } }).building?.id;
    interior.cameras.main.fadeOut(200, 0, 0, 0);
    interior.cameras.main.once('camerafadeoutcomplete', () => {
      game.scene.stop('interior');
      game.scene.start('campus', { from });
    });
  });

  // Test/debug hook used by the Playwright playthroughs.
  const active = () => game.scene.getScenes(true).find((sc) => sc.scene.key !== 'boot') as (Phaser.Scene & { player?: { sprite: Phaser.Physics.Arcade.Sprite; face: (d: string) => void } }) | undefined;
  (window as unknown as { __dq?: unknown }).__dq = {
    scene: () => active()?.scene.key,
    player: () => {
      const p = active()?.player?.sprite;
      return p ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
    },
    teleport: (x: number, y: number, face = 'up') => {
      const s = active();
      s?.player?.sprite.setPosition(x, y);
      s?.player?.face(face);
    },
  };

  return {
    game,
    destroy: () => {
      offEnter();
      offExit();
      game.destroy(true);
    },
  };
}

export function refreshPlayerLook(game: Phaser.Game) {
  const s = game.scene.getScenes(true)[0];
  if (s) registerPlayer(s);
}
