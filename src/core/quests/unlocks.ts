// Progression rules shared by the overworld, HUD and quest log.
import type { SaveData } from '../progress/store';
import { WORLDS } from '../../departments/sql';
import type { World } from '../../departments/sql/types';

export const FINAL_BOSS_ID = 'final-boss';
export const MINI_BOSS_AFTER = 5;

export function world(id: number): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function bossBeaten(save: SaveData, bossId: string) {
  return !!save.bosses[bossId];
}

export type WorldState = 'locked' | 'building' | 'open' | 'cleared';

/** 'building' = unlocked by progress, but its content isn't in this build yet. */
export function worldState(save: SaveData, id: number): WorldState {
  if (id === 8) {
    const allBosses = [1, 2, 3, 4, 5, 6, 7].every((n) => bossBeaten(save, `w${n}-boss`));
    if (bossBeaten(save, FINAL_BOSS_ID)) return 'cleared';
    return allBosses ? 'open' : 'locked';
  }
  const w = world(id);
  const unlocked = id === 1 ? !!save.flags.introDone : bossBeaten(save, `w${id - 1}-boss`) || !!save.flags.unlockAll;
  if (!unlocked) return 'locked';
  if (!w) return 'building';
  return bossBeaten(save, w.boss.id) ? 'cleared' : 'open';
}

export type ChallengeState = 'locked' | 'available' | 'solved';

export function challengeState(save: SaveData, w: World, idx: number): ChallengeState {
  const id = w.challenges[idx];
  if (save.solved[id]) return 'solved';
  if (idx === 0 || save.solved[w.challenges[idx - 1]] || save.flags.unlockAll) return 'available';
  return 'locked';
}

export type BossState = 'locked' | 'available' | 'beaten';

export function bossState(save: SaveData, w: World, which: 'mini' | 'boss'): BossState {
  const b = which === 'mini' ? w.miniBoss : w.boss;
  if (bossBeaten(save, b.id)) return 'beaten';
  const solved = w.challenges.filter((c) => save.solved[c]).length;
  if (save.flags.unlockAll) return 'available';
  if (which === 'mini') return solved >= MINI_BOSS_AFTER ? 'available' : 'locked';
  return solved === w.challenges.length && bossBeaten(save, w.miniBoss.id) ? 'available' : 'locked';
}

export function arcadeUnlocked(save: SaveData) {
  return bossBeaten(save, 'w1-mini') || !!save.flags.unlockAll;
}

export interface Objective {
  text: string;
  building: string | null;
}

const BUILDING_OF_WORLD: Record<number, string> = { 1: 'lot', 2: 'showroom', 3: 'service', 4: 'fi', 5: 'vault', 6: 'data', 7: 'hr', 8: 'hq' };
export const buildingOfWorld = (id: number) => BUILDING_OF_WORLD[id];

export function currentObjective(save: SaveData): Objective {
  if (!save.flags.introDone) return { text: 'Talk to Rhonda, the GM, at the lot entrance.', building: null };
  for (let id = 1; id <= 7; id++) {
    const st = worldState(save, id);
    if (st === 'cleared') continue;
    const where = BUILDING_OF_WORLD[id];
    const w = world(id);
    if (st === 'building' || !w) return { text: `The next department is still being built. Check back soon!`, building: where };
    const next = w.challenges.findIndex((_, i) => challengeState(save, w, i) === 'available');
    const mini = bossState(save, w, 'mini');
    const boss = bossState(save, w, 'boss');
    if (mini === 'available') return { text: `Defeat ${w.miniBoss.name} in the ${w.name}.`, building: where };
    if (boss === 'available') return { text: `BOSS: defeat ${w.boss.name} in the ${w.name}!`, building: where };
    if (next !== -1) return { text: `${w.name}: solve "${challengeTitle(w, next)}" at terminal ${next + 1}.`, building: where };
    return { text: `Explore the ${w.name}.`, building: where };
  }
  if (worldState(save, 8) === 'open') return { text: 'FINAL BOSS: the Monthly Ops Review awaits in the GM Office.', building: 'hq' };
  return { text: 'You cleared Phase 1! Replay bosses for S ranks, or wait for the next department to open.', building: null };
}

import { CHALLENGE_BY_ID } from '../../departments/sql';
function challengeTitle(w: World, idx: number) {
  return CHALLENGE_BY_ID[w.challenges[idx]]?.title ?? '';
}
