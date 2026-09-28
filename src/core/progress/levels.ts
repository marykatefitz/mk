export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: 'Lot Porter' },
  { level: 4, title: 'Detail Tech' },
  { level: 8, title: 'BDC Rep' },
  { level: 12, title: 'Sales Consultant' },
  { level: 16, title: 'Service Advisor' },
  { level: 21, title: 'F&I Manager' },
  { level: 26, title: 'Sales Manager' },
  { level: 31, title: 'Controller' },
  { level: 38, title: 'General Manager' },
  { level: 45, title: 'Dealer Principal' },
];

export const MAX_LEVEL = 50;

/** Total XP needed to reach a level (level 1 = 0). Gently rising curve. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(80 * Math.pow(level - 1, 1.45));
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export function titleFor(level: number): string {
  let t = TITLES[0].title;
  for (const x of TITLES) if (level >= x.level) t = x.title;
  return t;
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, title: titleFor(level), into: xp - base, span: next - base, pct: level >= MAX_LEVEL ? 1 : (xp - base) / (next - base) };
}
