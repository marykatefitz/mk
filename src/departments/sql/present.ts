import type { SqlEngine } from '../../engines/types';
import type { PresentCard, PresentStep } from './types';

export async function computeFacts(engine: SqlEngine, step: PresentStep): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {};
  for (const [k, sql] of Object.entries(step.facts)) {
    const r = await engine.query(sql);
    const v = r.rows[0]?.[0];
    out[k] = typeof v === 'number' ? v : String(v ?? '');
  }
  return out;
}

export function fillCard(text: string, facts: Record<string, number | string>): string {
  return text.replace(/\{(\w+)(?::([$%]))?\}/g, (_m, key: string, fmt?: string) => {
    const v = facts[key];
    if (typeof v !== 'number') return String(v ?? `{${key}}`);
    if (fmt === '$') return `$${Math.round(v).toLocaleString('en-US')}`;
    if (fmt === '%') return `${(Math.round(v * 10) / 10).toLocaleString('en-US')}%`;
    return (Math.round(v * 10) / 10).toLocaleString('en-US');
  });
}

export const SLOTS = [
  { role: 'answer', label: '1. Answer', tip: 'Lead with the direct answer to the question.' },
  { role: 'sowhat', label: '2. So what', tip: 'Why it matters / what to do about it.' },
  { role: 'detail', label: '3. Detail', tip: 'The key supporting number or caveat.' },
] as const;

export interface PresentScore {
  ok: boolean;
  feedback: string[];
}

export function scorePresentation(picked: (PresentCard | null)[]): PresentScore {
  const feedback: string[] = [];
  picked.forEach((c, i) => {
    if (!c) {
      feedback.push(`Slot "${SLOTS[i].label}" is empty.`);
      return;
    }
    if (c.role !== SLOTS[i].role) feedback.push(c.note);
  });
  return { ok: feedback.length === 0, feedback };
}
