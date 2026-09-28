import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CODEX_BY_ID } from '../src/core/codex';
import { NPCS } from '../src/core/characters';
import { compareResults } from '../src/departments/sql/checker';
import { CHALLENGES, CHALLENGE_BY_ID, WORLDS } from '../src/departments/sql';
import { predictOptions } from '../src/departments/sql/predict';
import { computeFacts, fillCard } from '../src/departments/sql/present';
import { buildSteps } from '../src/departments/sql/xray';
import type { SqlEngine } from '../src/engines/types';
import { loadedEngine } from './helpers';

let e: SqlEngine;
beforeAll(async () => {
  e = await loadedEngine();
});
afterAll(() => e.close());

describe('challenge catalog', () => {
  it('ids are unique and every world/boss reference resolves', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const w of WORLDS) {
      for (const id of w.challenges) expect(CHALLENGE_BY_ID[id], id).toBeDefined();
      for (const b of [w.miniBoss, w.boss]) for (const p of b.phases) for (const id of p.questions) expect(CHALLENGE_BY_ID[id], id).toBeDefined();
    }
  });

  it('every challenge has 3 hints, a why-note, a real giver and valid codex links', () => {
    for (const c of CHALLENGES) {
      expect(c.hints.length, c.id).toBe(3);
      expect(c.why.length, c.id).toBeGreaterThan(20);
      expect(NPCS[c.giver], c.id).toBeDefined();
      for (const t of c.codex ?? []) expect(CODEX_BY_ID[t], `${c.id} → ${t}`).toBeDefined();
    }
  });
});

describe.each(CHALLENGES.map((c) => [c.id, c] as const))('challenge %s', (id, c) => {
  if (c.type === 'write' || c.type === 'fix') {
    it('reference solution runs and returns rows', async () => {
      const r = await e.query(c.solution);
      expect(r.rows.length, id).toBeGreaterThan(0);
      if (c.expectedColumns) expect(r.columns.length).toBe(c.expectedColumns.length);
    });
    it('reference solution passes its own checker and has a working X-Ray', async () => {
      const r = await e.query(c.solution);
      expect(compareResults(r, r, c.solution, { orderMatters: c.orderMatters }).ok).toBe(true);
      expect(buildSteps(c.solution).length).toBeGreaterThan(0);
    });
    if (c.type === 'fix') {
      it('the broken starter really is wrong', async () => {
        const good = await e.query(c.solution);
        let wrong = true;
        try {
          const bad = await e.query(c.starter!);
          wrong = !compareResults(good, bad, c.starter!, { orderMatters: c.orderMatters }).ok;
        } catch {
          wrong = true;
        }
        expect(wrong).toBe(true);
      });
    }
  }
  if (c.type === 'read') {
    it('query runs and choices are well-formed', async () => {
      await e.query(c.query);
      expect(c.choices.length).toBe(c.explanations.length);
      expect(c.answer).toBeGreaterThanOrEqual(0);
      expect(c.answer).toBeLessThan(c.choices.length);
    });
  }
  if (c.type === 'present' || c.type === 'stakeholder') {
    it('facts compute and every card renders with numbers', async () => {
      const facts = await computeFacts(e, c.present);
      for (const [k, v] of Object.entries(facts)) expect(typeof v === 'number' && Number.isFinite(v), `${id}.${k}`).toBe(true);
      for (const card of c.present.cards) expect(fillCard(card.text, facts)).not.toMatch(/\{\w+/);
      for (const role of ['answer', 'sowhat', 'detail']) expect(c.present.cards.filter((x) => x.role === role).length, role).toBe(1);
    });
  }
  if (c.type === 'stakeholder') {
    it('investigation solution runs and clarify has enough good questions', async () => {
      const r = await e.query(c.investigate.solution);
      expect(r.rows.length).toBeGreaterThan(0);
      expect(c.clarify.filter((q) => q.good).length).toBeGreaterThanOrEqual(2);
      if (c.flag) expect(c.flag.options.filter((o) => o.correct).length).toBe(1);
    });
  }
  if (c.type === 'predict') {
    it('answer and decoys are all distinct numbers', async () => {
      const opts = await predictOptions(e, c);
      const values = opts.map((o) => o.value);
      expect(new Set(values).size, JSON.stringify(values)).toBe(values.length);
      expect(opts.filter((o) => o.correct).length).toBe(1);
    });
  }
});
