import type { Challenge, World } from './types';
import { W1_CHALLENGES, WORLD_1 } from './worlds/w1-lot';

export const WORLDS: World[] = [WORLD_1];

export const CHALLENGES: Challenge[] = [...W1_CHALLENGES];

export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export function worldOf(challengeId: string): World | undefined {
  const c = CHALLENGE_BY_ID[challengeId];
  return c && WORLDS.find((w) => w.id === c.world);
}
