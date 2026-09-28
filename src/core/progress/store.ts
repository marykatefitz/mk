import { create } from 'zustand';
import { levelForXp } from './levels';

// ------------------------------------------------------------------ types ---

export interface PlayerLook {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'curly' | 'buzz' | 'cap';
  shirt: string;
  pants: string;
}

export interface SolvedInfo {
  at: number;
  attempts: number;
  hints: number;
  firstTry: boolean;
  golden: boolean;
  sql?: string;
}

export interface BossRecord {
  grade: 'S' | 'A' | 'B' | 'C';
  at: number;
  wins: number;
}

export interface DailyQuest {
  id: string;
  label: string;
  kind: 'solve' | 'read' | 'minigame' | 'xray' | 'hintless';
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface SaveData {
  version: 1;
  createdAt: number;
  updatedAt: number;
  playSeconds: number;
  player: { name: string; look: PlayerLook };
  xp: number;
  coins: number;
  solved: Record<string, SolvedInfo>;
  attempts: Record<string, number>;
  hints: Record<string, number>;
  codex: string[];
  bosses: Record<string, BossRecord>;
  achievements: string[];
  inventory: string[];
  flags: Record<string, boolean | number | string>;
  daily: { date: string; quests: DailyQuest[] };
  streak: { count: number; last: string; freezes: number };
  stats: { queriesRun: number; xrays: number; untangles: number; askedEarly: number; stakeholder: number; minigames: number };
  minigames: Record<string, number>;
  position?: { x: number; y: number; facing: string };
}

export const SLOT_COUNT = 3;
const SLOT_KEY = (i: number) => `dq.slot.${i}`;
const ACTIVE_KEY = 'dq.activeSlot';

// --------------------------------------------------------------- storage ---

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game keeps running in memory */
  }
}

export function freshSave(name: string, look: PlayerLook): SaveData {
  const now = Date.now();
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    playSeconds: 0,
    player: { name, look },
    xp: 0,
    coins: 60,
    solved: {},
    attempts: {},
    hints: {},
    codex: [],
    bosses: {},
    achievements: [],
    inventory: [],
    flags: {},
    daily: { date: '', quests: [] },
    streak: { count: 0, last: '', freezes: 1 },
    stats: { queriesRun: 0, xrays: 0, untangles: 0, askedEarly: 0, stakeholder: 0, minigames: 0 },
    minigames: {},
  };
}

/** Fill in fields added in later versions so old saves keep loading. */
export function migrate(s: Partial<SaveData> & { player: SaveData['player'] }): SaveData {
  const base = freshSave(s.player.name, s.player.look);
  return { ...base, ...s, stats: { ...base.stats, ...(s.stats ?? {}) }, streak: { ...base.streak, ...(s.streak ?? {}) } } as SaveData;
}

// ----------------------------------------------------------------- store ---

export interface RewardEvent {
  xp: number;
  coins: number;
  levelBefore: number;
  levelAfter: number;
  golden: boolean;
  codex: string[];
  label: string;
}

interface ProgressState {
  slot: number | null;
  save: SaveData | null;
  slots: (SaveData | null)[];
  lastReward: RewardEvent | null;

  refreshSlots(): void;
  newGame(slot: number, name: string, look: PlayerLook): void;
  loadSlot(slot: number): boolean;
  deleteSlot(slot: number): void;
  quit(): void;
  update(fn: (s: SaveData) => void): void;
  grant(label: string, xp: number, coins: number, extra?: { golden?: boolean; codex?: string[] }): RewardEvent | null;
  spend(coins: number): boolean;
  setFlag(key: string, value: boolean | number | string): void;
  exportAll(): string;
  importAll(json: string): number;
  clearReward(): void;
}

function persist(slot: number | null, save: SaveData | null) {
  if (slot === null || !save) return;
  save.updatedAt = Date.now();
  write(SLOT_KEY(slot), save);
}

export const useProgress = create<ProgressState>((set, get) => ({
  slot: null,
  save: null,
  slots: Array.from({ length: SLOT_COUNT }, (_, i) => read<SaveData>(SLOT_KEY(i))),
  lastReward: null,

  refreshSlots() {
    set({ slots: Array.from({ length: SLOT_COUNT }, (_, i) => read<SaveData>(SLOT_KEY(i))) });
  },
  newGame(slot, name, look) {
    const save = freshSave(name, look);
    write(SLOT_KEY(slot), save);
    write(ACTIVE_KEY, slot);
    set({ slot, save });
    get().refreshSlots();
  },
  loadSlot(slot) {
    const raw = read<SaveData>(SLOT_KEY(slot));
    if (!raw) return false;
    const save = migrate(raw);
    write(ACTIVE_KEY, slot);
    set({ slot, save });
    return true;
  },
  deleteSlot(slot) {
    write(SLOT_KEY(slot), null);
    if (get().slot === slot) set({ slot: null, save: null });
    get().refreshSlots();
  },
  quit() {
    persist(get().slot, get().save);
    set({ slot: null, save: null });
    get().refreshSlots();
  },
  update(fn) {
    const { save, slot } = get();
    if (!save) return;
    const next = structuredClone(save);
    fn(next);
    persist(slot, next);
    set({ save: next });
  },
  grant(label, xp, coins, extra = {}) {
    const { save } = get();
    if (!save) return null;
    const before = levelForXp(save.xp);
    const newCodex = (extra.codex ?? []).filter((c) => !save.codex.includes(c));
    get().update((s) => {
      s.xp += xp;
      s.coins += coins;
      s.codex.push(...newCodex);
      if (extra.golden) s.inventory.push(`golden:${label}`);
    });
    const ev: RewardEvent = {
      xp,
      coins,
      levelBefore: before,
      levelAfter: levelForXp(get().save!.xp),
      golden: !!extra.golden,
      codex: newCodex,
      label,
    };
    set({ lastReward: ev });
    return ev;
  },
  spend(coins) {
    const { save } = get();
    if (!save || save.coins < coins) return false;
    get().update((s) => {
      s.coins -= coins;
    });
    return true;
  },
  setFlag(key, value) {
    get().update((s) => {
      s.flags[key] = value;
    });
  },
  exportAll() {
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => read<SaveData>(SLOT_KEY(i)));
    return JSON.stringify({ game: 'dealer-quest', exportedAt: new Date().toISOString(), slots, settings: read('dq.settings') }, null, 2);
  },
  importAll(json) {
    const data = JSON.parse(json);
    if (data?.game !== 'dealer-quest' || !Array.isArray(data.slots)) throw new Error('That file is not a Dealer Quest backup.');
    let n = 0;
    data.slots.slice(0, SLOT_COUNT).forEach((s: SaveData | null, i: number) => {
      if (s && s.player) {
        write(SLOT_KEY(i), migrate(s));
        n++;
      }
    });
    if (data.settings) write('dq.settings', data.settings);
    get().refreshSlots();
    return n;
  },
  clearReward() {
    set({ lastReward: null });
  },
}));

export function lastActiveSlot(): number | null {
  return read<number>(ACTIVE_KEY);
}
