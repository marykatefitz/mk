import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { significant, tokenize } from '../src/departments/sql/parse/tokenize';
import type { SqlEngine } from '../src/engines/types';
import { BUGS, ROULETTE, clauseRounds } from '../src/minigames/games';
import { loadedEngine } from './helpers';

describe('minigames content', () => {
  it('every Bug Hunt query has exactly one findable bug token', () => {
    for (const b of BUGS) {
      const toks = significant(tokenize(b.sql));
      const hits = toks.filter((t) => t.text === b.bug || t.upper === b.bug.toUpperCase());
      expect(hits.length, b.sql).toBe(1);
    }
  });

  it('Clause Order has plenty of rounds built from real challenge solutions', () => {
    const rounds = clauseRounds();
    expect(rounds.length).toBeGreaterThan(20);
    for (const r of rounds) expect(r.chips[0].kind).toBe('FROM');
  });

  describe('Row Count Roulette', () => {
    let e: SqlEngine;
    beforeAll(async () => {
      e = await loadedEngine();
    });
    afterAll(() => e.close());
    it('every query runs', async () => {
      for (const q of ROULETTE) {
        const r = await e.query(`SELECT COUNT(*) FROM (${q}) x`);
        expect(Number(r.rows[0][0]), q).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
