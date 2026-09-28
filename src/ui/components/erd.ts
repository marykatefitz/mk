import { TABLES, type TableDef } from '../../data/schema';

export const CARD_W = 200;
export const ROW_H = 20;
export const HEAD_H = 30;

/** Hand-placed ERD layout, grouped by source system. */
export const ERD_POS: Record<string, { x: number; y: number }> = {
  curtailments: { x: 30, y: 40 },
  floorplan_loans: { x: 30, y: 220 },
  wo_jobs: { x: 30, y: 470 },
  units: { x: 290, y: 40 },
  locations: { x: 290, y: 280 },
  work_orders: { x: 290, y: 470 },
  deals: { x: 550, y: 40 },
  fi_products: { x: 550, y: 330 },
  leads: { x: 810, y: 40 },
  customers: { x: 810, y: 330 },
  employees: { x: 1070, y: 40 },
  pay_history: { x: 1070, y: 320 },
  time_off: { x: 1070, y: 450 },
  training_completions: { x: 810, y: 520 },
};
export const ERD_SIZE = { w: 1300, h: 680 };

export const SYSTEM_COLOR: Record<string, string> = {
  DMS: 'var(--orange)',
  CRM: 'var(--teal)',
  'Floorplan portal': 'var(--purple)',
  HRIS: 'var(--blue)',
  'Service (DMS)': 'var(--green)',
};

/** Only key columns are drawn on ERD cards. */
export function keyColumns(t: TableDef) {
  return t.columns.filter((c) => c.pk || c.fk);
}

export interface Edge {
  from: { table: string; column: string };
  to: { table: string; column: string };
}

export function edges(): Edge[] {
  const out: Edge[] = [];
  for (const t of TABLES) {
    for (const c of t.columns) {
      if (c.fk) out.push({ from: { table: t.name, column: c.name }, to: c.fk });
    }
  }
  return out;
}

export function columnAnchor(table: string, column: string, side: 'left' | 'right') {
  const t = TABLES.find((x) => x.name === table)!;
  const idx = keyColumns(t).findIndex((c) => c.name === column);
  const p = ERD_POS[table];
  return { x: p.x + (side === 'right' ? CARD_W : 0), y: p.y + HEAD_H + ROW_H * Math.max(0, idx) + ROW_H / 2 };
}

export function cardHeight(t: TableDef) {
  return HEAD_H + ROW_H * keyColumns(t).length + 22;
}
