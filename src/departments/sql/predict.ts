import type { SqlEngine } from '../../engines/types';
import type { PredictChallenge } from './types';

export interface PredictOption {
  value: number;
  correct: boolean;
  why: string;
}

/** Compute the real answer and the decoy values for a Predict-it challenge. */
export async function predictOptions(engine: SqlEngine, c: PredictChallenge): Promise<PredictOption[]> {
  const real =
    c.measure === 'rows'
      ? Number((await engine.query(`SELECT COUNT(*) FROM (${c.query}) AS q`)).rows[0][0])
      : Number((await engine.query(c.query)).rows[0][0]);
  const opts: PredictOption[] = [{ value: round(real), correct: true, why: c.explanation }];
  for (const d of c.decoys) {
    const v = Number((await engine.query(d.sql)).rows[0][0]);
    opts.push({ value: round(v), correct: false, why: d.why });
  }
  return opts;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Deterministic shuffle so options don't always put the answer first. */
export function shuffleOptions<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
