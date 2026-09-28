// Meta-progression: daily quests + streaks, achievements, skill tree.
import { CHALLENGE_BY_ID, CHALLENGES } from '../../departments/sql';
import { useProgress, type DailyQuest, type SaveData } from './store';
import { levelForXp } from './levels';

// ------------------------------------------------------------ dates ---

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

// ------------------------------------------------------- daily quests ---

const DAILY_POOL: Omit<DailyQuest, 'progress' | 'claimed'>[] = [
  { id: 'solve2', label: 'Solve 2 challenges', kind: 'solve', target: 2, reward: 30 },
  { id: 'solve4', label: 'Solve 4 challenges', kind: 'solve', target: 4, reward: 60 },
  { id: 'read1', label: 'Solve a Read-it challenge', kind: 'read', target: 1, reward: 30 },
  { id: 'xray3', label: 'X-Ray 3 queries', kind: 'xray', target: 3, reward: 25 },
  { id: 'mini2', label: 'Play 2 arcade minigames', kind: 'minigame', target: 2, reward: 35 },
  { id: 'hintless2', label: 'Solve 2 challenges without hints', kind: 'hintless', target: 2, reward: 45 },
];

function pickDaily(date: string): DailyQuest[] {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_POOL];
  const out: DailyQuest[] = [];
  while (out.length < 3 && pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    const q = pool.splice(h % pool.length, 1)[0];
    out.push({ ...q, progress: 0, claimed: false });
  }
  return out;
}

/** Roll today's quests if needed. */
export function ensureDaily() {
  const today = todayKey();
  const save = useProgress.getState().save;
  if (!save || save.daily.date === today) return;
  useProgress.getState().update((s) => {
    s.daily = { date: today, quests: pickDaily(today) };
  });
}

export type ActivityKind = DailyQuest['kind'] | 'boss';

/** Record activity: advances daily quests and the streak. */
export function trackActivity(kind: ActivityKind, n = 1) {
  ensureDaily();
  const today = todayKey();
  useProgress.getState().update((s) => {
    for (const q of s.daily.quests) if (q.kind === kind) q.progress = Math.min(q.target, q.progress + n);
    // streak
    if (s.streak.last !== today) {
      const gap = s.streak.last ? daysBetween(s.streak.last, today) : 1;
      if (gap === 1) s.streak.count += 1;
      else if (gap === 2 && s.streak.freezes > 0) {
        s.streak.freezes -= 1;
        s.streak.count += 1;
      } else s.streak.count = 1;
      s.streak.last = today;
      if (s.streak.count % 7 === 0) s.streak.freezes = Math.min(3, s.streak.freezes + 1);
    }
  });
  checkAchievements();
}

export function claimDaily(id: string) {
  const s = useProgress.getState().save;
  const q = s?.daily.quests.find((x) => x.id === id);
  if (!q || q.claimed || q.progress < q.target) return;
  useProgress.getState().update((sv) => {
    const qq = sv.daily.quests.find((x) => x.id === id)!;
    qq.claimed = true;
  });
  useProgress.getState().grant(`Daily: ${q.label}`, 20, q.reward);
}

// -------------------------------------------------------- achievements ---

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  test: (s: SaveData) => boolean;
}

const solvedCount = (s: SaveData) => Object.keys(s.solved).filter((id) => !CHALLENGE_BY_ID[id]?.bossOnly).length;
const solvedOfType = (s: SaveData, t: string) => Object.keys(s.solved).filter((id) => CHALLENGE_BY_ID[id]?.type === t && !CHALLENGE_BY_ID[id]?.bossOnly).length;
const golden = (s: SaveData) => s.inventory.filter((x) => x.startsWith('golden:')).length;
const bossWins = (s: SaveData) => Object.keys(s.bosses).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-query', name: 'Hello, World (of RVs)', icon: '👋', desc: 'Solve your first challenge.', test: (s) => solvedCount(s) >= 1 },
  { id: 'ten', name: 'Lot Walker', icon: '🚶', desc: 'Solve 10 challenges.', test: (s) => solvedCount(s) >= 10 },
  { id: 'twentyfive', name: 'Deal Maker', icon: '🤝', desc: 'Solve 25 challenges.', test: (s) => solvedCount(s) >= 25 },
  { id: 'fifty', name: 'Data Closer', icon: '🏁', desc: 'Solve 50 challenges.', test: (s) => solvedCount(s) >= 50 },
  { id: 'all', name: 'Every Terminal', icon: '🖥️', desc: 'Solve every Phase 1 challenge.', test: (s) => solvedCount(s) >= CHALLENGES.filter((c) => !c.bossOnly).length },
  { id: 'reader', name: 'Speed Reader', icon: '👓', desc: 'Solve 5 Read-it challenges.', test: (s) => solvedOfType(s, 'read') >= 5 },
  { id: 'fixer', name: 'Bug Squasher', icon: '🔧', desc: 'Solve 5 Fix-it challenges.', test: (s) => solvedOfType(s, 'fix') >= 5 },
  { id: 'oracle', name: 'Oracle of Rows', icon: '🔮', desc: 'Solve 5 Predict-it challenges.', test: (s) => solvedOfType(s, 'predict') >= 5 },
  { id: 'golden1', name: 'Golden Touch', icon: '✨', desc: 'Earn a golden query card (first try, no hints).', test: (s) => golden(s) >= 1 },
  { id: 'golden10', name: 'Golden Garage', icon: '🌟', desc: 'Earn 10 golden query cards.', test: (s) => golden(s) >= 10 },
  { id: 'xray10', name: 'Radiologist', icon: '🩻', desc: 'Use Query X-Ray 10 times.', test: (s) => s.stats.xrays >= 10 },
  { id: 'untangle10', name: 'Knot Buster', icon: '🧶', desc: 'Untangle 10 queries.', test: (s) => s.stats.untangles >= 10 },
  { id: 'queries100', name: 'Query Machine', icon: '⚙️', desc: 'Run 100 queries.', test: (s) => s.stats.queriesRun >= 100 },
  { id: 'asked', name: 'Asks Early', icon: '🙋', desc: 'Ask the right person for help when stuck.', test: (s) => s.stats.askedEarly >= 1 },
  { id: 'asked5', name: 'Team Player', icon: '🫶', desc: 'Ask for help early 5 times.', test: (s) => s.stats.askedEarly >= 5 },
  { id: 'mini1', name: 'Mini Menace', icon: '⚔️', desc: 'Defeat a mini-boss.', test: (s) => Object.keys(s.bosses).some((b) => b.endsWith('-mini')) },
  { id: 'boss1', name: 'Boss Buster', icon: '👑', desc: 'Defeat a world boss.', test: (s) => Object.keys(s.bosses).some((b) => b.endsWith('-boss')) },
  { id: 'gremlin', name: 'NULL and Void', icon: '👻', desc: 'Defeat the Null Gremlin.', test: (s) => !!s.bosses['w1-boss'] },
  { id: 'phantom', name: 'No Fan-Out Zone', icon: '🧹', desc: 'Defeat the Fan-Out Phantom.', test: (s) => !!s.bosses['w3-boss'] },
  { id: 'hydra', name: 'Hydra Slayer', icon: '🐉', desc: 'Defeat the Duplicate Lead Hydra.', test: (s) => !!s.bosses['w6-boss'] },
  { id: 'collector', name: 'Paid in Full', icon: '💸', desc: 'Defeat the Curtailment Collector.', test: (s) => !!s.bosses['w5-boss'] },
  { id: 's-rank', name: 'S-Rank Analyst', icon: '🥇', desc: 'Get an S grade on any boss.', test: (s) => Object.values(s.bosses).some((b) => b.grade === 'S') },
  { id: 'bosses5', name: 'Monster Manager', icon: '🗡️', desc: 'Win 5 boss battles.', test: (s) => bossWins(s) >= 5 },
  { id: 'final', name: 'Ops Review Survivor', icon: '📊', desc: 'Beat the Monthly Ops Review.', test: (s) => !!s.bosses['final-boss'] },
  { id: 'streak3', name: 'On a Roll', icon: '🔥', desc: 'Play 3 days in a row.', test: (s) => s.streak.count >= 3 },
  { id: 'streak7', name: 'Week Warrior', icon: '📅', desc: 'Play 7 days in a row.', test: (s) => s.streak.count >= 7 },
  { id: 'lvl5', name: 'Moving Up', icon: '📈', desc: 'Reach level 5.', test: (s) => levelForXp(s.xp) >= 5 },
  { id: 'lvl12', name: 'Sales Consultant', icon: '🧑‍💼', desc: 'Reach level 12.', test: (s) => levelForXp(s.xp) >= 12 },
  { id: 'codex15', name: 'Walking Glossary', icon: '📖', desc: 'Unlock 15 codex terms.', test: (s) => s.codex.length >= 15 },
  { id: 'stakeholder', name: 'Answer First', icon: '🗣️', desc: 'Nail a Stakeholder Mode presentation.', test: (s) => s.stats.stakeholder >= 1 },
  { id: 'arcade', name: 'Arcade Regular', icon: '🕹️', desc: 'Play 10 minigames.', test: (s) => s.stats.minigames >= 10 },
  { id: 'rich', name: 'Floorplan Free', icon: '💰', desc: 'Hold 500 coins at once.', test: (s) => s.coins >= 500 },
];

let announce: ((a: Achievement) => void) | null = null;
export function onAchievement(fn: (a: Achievement) => void) {
  announce = fn;
  return () => {
    if (announce === fn) announce = null;
  };
}

export function checkAchievements() {
  const save = useProgress.getState().save;
  if (!save) return;
  const fresh = ACHIEVEMENTS.filter((a) => !save.achievements.includes(a.id) && a.test(save));
  if (!fresh.length) return;
  useProgress.getState().update((s) => {
    for (const a of fresh) s.achievements.push(a.id);
  });
  for (const a of fresh) announce?.(a);
}

// ----------------------------------------------------------- skill tree ---

export interface SkillNode {
  id: string;
  name: string;
  concepts: RegExp;
}

export const SQL_SKILLS: SkillNode[] = [
  { id: 'basics', name: 'SELECT basics', concepts: /SELECT|LIMIT|DISTINCT|ORDER BY|calculated|alias/i },
  { id: 'filter', name: 'Filtering', concepts: /WHERE|AND|LIKE|BETWEEN|IN\b|<>|dates/i },
  { id: 'null', name: 'NULL handling', concepts: /NULL|COALESCE|COUNT\(\*\)/i },
  { id: 'agg', name: 'Aggregation', concepts: /GROUP BY|HAVING|COUNT|SUM|AVG|COUNT_IF/i },
  { id: 'joins', name: 'Joins', concepts: /JOIN|composite|anti/i },
  { id: 'case', name: 'Conditional logic', concepts: /CASE|conditional|PVR|penetration/i },
  { id: 'dates', name: 'Dates', concepts: /date|DATE_DIFF|aging|interval/i },
  { id: 'cte', name: 'CTEs & subqueries', concepts: /CTE|subquer|correlated/i },
  { id: 'window', name: 'Window functions', concepts: /ROW_NUMBER|RANK|LAG|window|running|QUALIFY|percent of total/i },
  { id: 'quality', name: 'Data quality', concepts: /duplicate|sentinel|orphan|-1|data quality|dedup/i },
  { id: 'self', name: 'Self-joins & cohorts', concepts: /self-join|cohort|recursive|turnover|tenure|headcount/i },
];

export function skillProgress(save: SaveData) {
  return SQL_SKILLS.map((n) => {
    const relevant = CHALLENGES.filter((c) => !c.bossOnly && c.concepts.some((k) => n.concepts.test(k)));
    const done = relevant.filter((c) => save.solved[c.id]).length;
    return { ...n, done, total: relevant.length };
  });
}

export const OTHER_TRACKS = [
  { name: 'Excel', phase: 2 },
  { name: 'Python', phase: 3 },
  { name: 'Data Engineering', phase: 4 },
  { name: 'Snowflake', phase: 5 },
  { name: 'JSON & Markdown', phase: 6 },
  { name: 'dbt', phase: 7 },
  { name: 'Streamlit', phase: 8 },
  { name: 'AI / LLMs', phase: 9 },
  { name: 'Git', phase: 10 },
  { name: 'Power BI', phase: 11 },
];
