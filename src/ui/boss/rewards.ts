import { isRvShowWeekend, RV_SHOW_COIN_MULTIPLIER } from '../../core/events';
import { trackActivity } from '../../core/progress/meta';
import { useProgress, type BossRecord } from '../../core/progress/store';
import type { BossDef } from '../../departments/sql/types';

const RANK = { S: 4, A: 3, B: 2, C: 1 } as const;

export function gradeFor(hp: number, hintsUsed: number): BossRecord['grade'] {
  if (hp >= 90 && hintsUsed === 0) return 'S';
  if (hp >= 70) return 'A';
  if (hp >= 40) return 'B';
  return 'C';
}

export function bossReward(boss: BossDef, r: { hp: number; hintsUsed: number; seconds: number }) {
  const save = useProgress.getState().save!;
  const prev = save.bosses[boss.id];
  const grade = gradeFor(r.hp, r.hintsUsed);
  const firstWin = !prev;
  const betterGrade = !prev || RANK[grade] > RANK[prev.grade];
  const base = boss.mini ? { xp: 150, coins: 50 } : { xp: 320, coins: 110 };
  const bonus = { S: 1.5, A: 1.25, B: 1, C: 0.8 }[grade];
  const mult = isRvShowWeekend(new Date()) ? RV_SHOW_COIN_MULTIPLIER : 1;
  return {
    grade,
    firstWin,
    betterGrade,
    xp: firstWin ? Math.round(base.xp * bonus) : betterGrade ? 40 : 15,
    coins: Math.round((firstWin ? base.coins * bonus : 20) * mult),
  };
}

/** result=null records a defeat (XP for correct answers only). */
export function recordBossResult(boss: BossDef, result: ReturnType<typeof bossReward> | null, correct: number) {
  const store = useProgress.getState();
  if (!result) {
    if (correct > 0) store.grant(`${boss.name} (defeat)`, correct * 10, 0);
    return;
  }
  store.update((s) => {
    const prev = s.bosses[boss.id];
    s.bosses[boss.id] = {
      grade: prev && RANK[prev.grade] >= RANK[result.grade] ? prev.grade : result.grade,
      at: Date.now(),
      wins: (prev?.wins ?? 0) + 1,
    };
    if (result.firstWin) s.inventory.push(`trophy:${boss.id}`);
  });
  store.grant(boss.name, result.xp, result.coins);
  trackActivity('boss');
}
