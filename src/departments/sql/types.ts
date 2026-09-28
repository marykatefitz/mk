import type { NpcId } from '../../core/characters';

export type ChallengeType = 'write' | 'read' | 'fix' | 'predict' | 'present' | 'stakeholder';

export interface SnowflakeNote {
  title: string;
  snowflake: string;
  duckdb: string;
  note?: string;
}

interface BaseChallenge {
  id: string;
  world: number;
  type: ChallengeType;
  title: string;
  giver: NpcId;
  /** in-character setup, 1–3 sentences */
  story: string;
  /** the precise business question */
  question: string;
  concepts: string[];
  hints: [string, string, string];
  /** shown after solving: why this matters at a dealership */
  why: string;
  /** codex term ids unlocked on solve */
  codex?: string[];
  snowflake?: SnowflakeNote[];
  /** boss-only questions don't appear in the world's challenge list */
  bossOnly?: boolean;
  xp?: number;
}

export interface WriteChallenge extends BaseChallenge {
  type: 'write' | 'fix';
  /** starter SQL (for fix: the broken query) */
  starter?: string;
  solution: string;
  orderMatters?: boolean;
  /** 'shape' only checks the column count and row count (for open-ended peeks) */
  check?: 'exact' | 'shape';
  /** columns the answer should have, shown to the player */
  expectedColumns?: string[];
}

export interface ReadChallenge extends BaseChallenge {
  type: 'read';
  query: string;
  choices: string[];
  answer: number;
  /** why each choice is right or wrong (same order as choices) */
  explanations: string[];
}

export interface PredictChallenge extends BaseChallenge {
  type: 'predict';
  query: string;
  /** what to predict: the number of rows, or the value in the first cell */
  measure: 'rows' | 'value';
  /** plausible wrong answers, each computed by a scalar query, with the misconception it represents */
  decoys: { sql: string; why: string }[];
  /** why the correct answer is right */
  explanation: string;
}

export interface PresentCard {
  id: string;
  /** may contain {fact} or {fact:$} or {fact:%} placeholders */
  text: string;
  role: 'answer' | 'sowhat' | 'detail' | 'distractor';
  /** feedback when this card is placed wrongly (or is a distractor) */
  note: string;
}

export interface PresentStep {
  /** scalar SQL queries whose values fill card placeholders */
  facts: Record<string, string>;
  cards: PresentCard[];
}

/** Build a 3-sentence answer: Answer → So-what → Detail. */
export interface PresentChallenge extends BaseChallenge {
  type: 'present';
  present: PresentStep;
}

/** A vague request: clarify → investigate → (flag bad data) → present. */
export interface StakeholderChallenge extends BaseChallenge {
  type: 'stakeholder';
  vague: string;
  clarify: { text: string; good: boolean; reply: string }[];
  investigate: {
    question: string;
    starter?: string;
    solution: string;
    orderMatters?: boolean;
    expectedColumns?: string[];
    hints: [string, string, string];
  };
  flag?: { prompt: string; options: { text: string; correct: boolean; reply: string }[] };
  present: PresentStep;
}

export type Challenge = WriteChallenge | ReadChallenge | PredictChallenge | PresentChallenge | StakeholderChallenge;

export interface LessonCard {
  title: string;
  body: string;
  sql?: string;
}

export interface BossDef {
  id: string;
  name: string;
  /** sprite key for the procedural monster generator */
  sprite: 'gremlin' | 'shuffler' | 'wraith' | 'funnel' | 'crab' | 'phantom' | 'ogre' | 'pirate' | 'anaconda' | 'collector' | 'specter' | 'hydra' | 'orgchart' | 'tornado' | 'board';
  mini: boolean;
  intro: string;
  victory: string;
  /** seconds per question */
  timer: number;
  phases: { name: string; taunt: string; questions: string[] }[];
}

export interface World {
  id: number;
  name: string;
  building: string;
  giver: NpcId;
  tagline: string;
  concepts: string[];
  lesson: LessonCard[];
  challenges: string[];
  miniBoss: BossDef;
  boss: BossDef;
}

export const XP_BY_TYPE: Record<ChallengeType, number> = { write: 50, fix: 50, read: 40, predict: 30, present: 40, stakeholder: 90 };
