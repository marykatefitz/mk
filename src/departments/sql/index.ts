import type { BossDef, Challenge, World } from './types';
import { W1_CHALLENGES, WORLD_1 } from './worlds/w1-lot';
import { W2_CHALLENGES, WORLD_2 } from './worlds/w2-sales';
import { W3_CHALLENGES, WORLD_3 } from './worlds/w3-service';
import { W4_CHALLENGES, WORLD_4 } from './worlds/w4-fi';

export const WORLDS: World[] = [WORLD_1, WORLD_2, WORLD_3, WORLD_4];

export const CHALLENGES: Challenge[] = [...W1_CHALLENGES, ...W2_CHALLENGES, ...W3_CHALLENGES, ...W4_CHALLENGES];

export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export function worldOf(challengeId: string): World | undefined {
  const c = CHALLENGE_BY_ID[challengeId];
  return c && WORLDS.find((w) => w.id === c.world);
}

/** The Monthly Ops Review (added with worlds 2–7). */
export const FINAL_BOSS: BossDef | null = null;
