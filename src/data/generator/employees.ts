import { day, type Day } from './dates';
import { FIRST_NAMES, LAST_NAMES, STORES } from './reference';
import { stream, type Rng } from './rng';
import type { Employee } from './types';

const START = day('2024-07-01');
const AS_OF = day('2026-06-30');
const YEAR = 365.25;

interface Slot {
  role: string;
  department: string;
  managerRole: string | null;
  count: (size: number) => number;
  medianTenureYears: number;
  type: 'Full-time' | 'Part-time';
  reasons: [string, number][];
}

const VOLUNTARY: [string, number][] = [
  ['Voluntary - new job', 50],
  ['Voluntary - relocation', 15],
  ['Involuntary - performance', 20],
  ['Involuntary - attendance', 10],
  ['Retirement', 5],
];

const STORE_SLOTS: Slot[] = [
  { role: 'General Manager', department: 'Admin', managerRole: 'Regional Manager', count: () => 1, medianTenureYears: 8, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Sales Manager', department: 'Sales', managerRole: 'General Manager', count: () => 1, medianTenureYears: 5, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Sales', department: 'Sales', managerRole: 'Sales Manager', count: (s) => Math.round(4.5 * s), medianTenureYears: 1.6, type: 'Full-time', reasons: [['Voluntary - new job', 45], ['Involuntary - performance', 35], ['Voluntary - relocation', 10], ['Involuntary - attendance', 10]] },
  { role: 'F&I Manager', department: 'F&I', managerRole: 'General Manager', count: (s) => (s >= 1.3 ? 2 : 1), medianTenureYears: 4, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Service Manager', department: 'Service', managerRole: 'General Manager', count: () => 1, medianTenureYears: 6, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Service Advisor', department: 'Service', managerRole: 'Service Manager', count: (s) => (s >= 1.2 ? 3 : 2), medianTenureYears: 2.5, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Technician', department: 'Service', managerRole: 'Service Manager', count: (s) => Math.round(4 * s), medianTenureYears: 4, type: 'Full-time', reasons: [['Voluntary - new job', 55], ['Voluntary - relocation', 10], ['Involuntary - performance', 10], ['Involuntary - attendance', 10], ['Retirement', 15]] },
  { role: 'Parts', department: 'Parts', managerRole: 'Service Manager', count: () => 1, medianTenureYears: 4, type: 'Full-time', reasons: VOLUNTARY },
  { role: 'Porter', department: 'Lot', managerRole: 'Sales Manager', count: (s) => (s >= 1.2 ? 2 : 1), medianTenureYears: 1.1, type: 'Part-time', reasons: [['Voluntary - new job', 60], ['Involuntary - attendance', 25], ['Involuntary - performance', 15]] },
];

interface Fixed {
  first: string;
  last: string;
  role: string;
  department: string;
  location: number | null;
  managerRole: string | null;
  hire: string;
  efficiency?: number;
}

/** The game's NPCs are real rows in the HR data. */
export const NPCS: Fixed[] = [
  { first: 'Rhonda', last: 'Vance', role: 'General Manager', department: 'Admin', location: 1, managerRole: 'Regional Manager', hire: '2012-05-14' },
  { first: 'Tony', last: 'Delgado', role: 'Sales Manager', department: 'Sales', location: 1, managerRole: 'General Manager', hire: '2016-02-01' },
  { first: 'Priya', last: 'Nair', role: 'Service Manager', department: 'Service', location: 1, managerRole: 'General Manager', hire: '2015-09-08' },
  { first: 'Walt', last: 'Kimura', role: 'F&I Manager', department: 'F&I', location: 1, managerRole: 'General Manager', hire: '2010-03-22' },
  { first: 'Earl', last: 'Buckley', role: 'Technician', department: 'Service', location: 1, managerRole: 'Service Manager', hire: '1998-06-01', efficiency: 1.6 },
  { first: 'Margaret', last: 'Okafor', role: 'Controller', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2013-01-07' },
  { first: 'Jess', last: 'Alvarez', role: 'HR', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2018-04-02' },
  { first: 'Devin', last: 'Park', role: 'Data Engineer', department: 'Corporate', location: null, managerRole: 'Controller', hire: '2021-07-12' },
  { first: 'Nova', last: 'Reyes', role: 'Data Scientist', department: 'Corporate', location: null, managerRole: 'Controller', hire: '2023-11-01' },
];

const CORPORATE: Fixed[] = [
  { first: 'Harold', last: 'Summers', role: 'Executive', department: 'Corporate', location: null, managerRole: null, hire: '1998-01-05' },
  { first: 'Colleen', last: 'Mayfield', role: 'Regional Manager', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2007-06-11' },
  { first: 'Marcus', last: 'Oyelaran', role: 'Regional Manager', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2011-02-28' },
  { first: 'Gretchen', last: 'Holm', role: 'Regional Manager', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2014-09-15' },
  { first: 'Ray', last: 'Villanueva', role: 'Regional Manager', department: 'Corporate', location: null, managerRole: 'Executive', hire: '2016-03-07' },
  { first: 'Tasha', last: 'Pruitt', role: 'HR', department: 'Corporate', location: null, managerRole: 'HR', hire: '2022-08-22' },
  { first: 'Sam', last: 'Whitfield', role: 'Data Engineer', department: 'Corporate', location: null, managerRole: 'Controller', hire: '2024-01-16' },
  { first: 'Lena', last: 'Brandt', role: 'Data Analyst', department: 'Corporate', location: null, managerRole: 'Controller', hire: '2022-04-04' },
  { first: 'Andre', last: 'Moss', role: 'Data Analyst', department: 'Corporate', location: null, managerRole: 'Controller', hire: '2025-05-12' },
];

/** Which regional manager covers which region (by index into CORPORATE regional list). */
const REGION_ORDER = ['Mountain', 'Southwest', 'Midwest', 'Southeast'];

export interface EmployeeWorld {
  employees: Employee[];
  /** employees of a role at a store who were active on a day */
  activeAt(storeId: number, roles: string[], d: Day): Employee[];
  pickActive(rng: Rng, storeId: number, roles: string[], d: Day): Employee;
}

export function generateEmployees(seed: number): EmployeeWorld {
  const rng = stream(seed, 'employees');
  const list: Employee[] = [];
  let key = 0;

  const make = (
    first: string,
    last: string,
    role: string,
    department: string,
    location: number | null,
    managerRole: string | null,
    hire: Day,
    term: Day | null,
    reason: string | null,
    type: Employee['employment_type'],
    efficiency = 1,
  ) => {
    const e: Employee = {
      key: key++,
      employee_id: 0,
      first_name: first,
      last_name: last,
      role,
      department,
      location_id: location,
      managerRole,
      manager_id: null,
      hire,
      term,
      termination_reason: reason,
      employment_type: type,
      efficiency,
    };
    list.push(e);
    return e;
  };

  const usedNames = new Set<string>([...NPCS, ...CORPORATE].map((f) => `${f.first} ${f.last}`));
  const name = (): [string, string] => {
    for (;;) {
      const f = rng.pick(FIRST_NAMES);
      const l = rng.pick(LAST_NAMES);
      if (!usedNames.has(`${f} ${l}`)) {
        usedNames.add(`${f} ${l}`);
        return [f, l];
      }
    }
  };
  const techEff = () => Math.min(1.45, Math.max(0.72, rng.normal(1.08, 0.15)));

  for (const f of [...CORPORATE, ...NPCS]) {
    make(f.first, f.last, f.role, f.department, f.location, f.managerRole, day(f.hire), null, null, 'Full-time', f.efficiency ?? (f.role === 'Technician' ? techEff() : 1));
  }

  for (const store of STORES) {
    const opened = day(store.opened);
    for (const slot of STORE_SLOTS) {
      let n = slot.count(store.size);
      // Denver's NPCs already fill one seat of their roles.
      if (store.id === 1) n -= NPCS.filter((f) => f.location === 1 && f.role === slot.role).length;
      for (let i = 0; i < n; i++) {
        const tenure = rng.logNormal(slot.medianTenureYears * YEAR, 0.8);
        let hire = Math.round(START - rng.next() * tenure);
        if (hire < opened) hire = opened + rng.int(0, 60);
        let term: Day | null = Math.round(hire + tenure);
        for (;;) {
          const active = term > AS_OF ? null : term;
          const [f, l] = name();
          const type = slot.type === 'Part-time' && rng.chance(0.5) ? 'Full-time' : slot.type;
          make(f, l, slot.role, slot.department, store.id, slot.managerRole, hire, active, active ? rng.weighted(slot.reasons) : null, type, slot.role === 'Technician' ? techEff() : 1);
          if (!active) break;
          hire = active + rng.int(7, 60);
          if (hire > AS_OF) break;
          term = Math.round(hire + rng.logNormal(slot.medianTenureYears * YEAR, 0.8));
        }
      }
    }
    // Seasonal porters for RV-show / spring season.
    for (const year of [2024, 2025, 2026]) {
      const n = Math.max(1, Math.round(2 * store.size));
      for (let i = 0; i < n; i++) {
        const hire = day(`${year}-02-15`) + rng.int(0, 60);
        let term: Day | null = day(`${year}-09-01`) + rng.int(0, 60);
        let reason: string | null = 'Seasonal - end of assignment';
        if (rng.chance(0.15)) {
          term = hire + rng.int(20, 120);
          reason = rng.pick(['Voluntary - new job', 'Involuntary - attendance']);
        }
        if (term > AS_OF) {
          term = null;
          reason = null;
        }
        if (term !== null && term < START) continue;
        const [f, l] = name();
        make(f, l, 'Porter', 'Lot', store.id, 'Sales Manager', hire, term, reason, 'Seasonal');
      }
    }
  }

  // Stable IDs: by hire date, then creation order.
  list.sort((a, b) => a.hire - b.hire || a.key - b.key);
  list.forEach((e, i) => (e.employee_id = 1001 + i));

  const regionals = list.filter((e) => e.role === 'Regional Manager').sort((a, b) => a.key - b.key);
  const storeRegion = new Map(STORES.map((s) => [s.id, s.region]));

  const activeAt = (storeId: number | null, roles: string[], d: Day) =>
    list.filter((e) => e.location_id === storeId && roles.includes(e.role) && e.hire <= d && (e.term === null || e.term >= d));

  for (const e of list) {
    if (!e.managerRole) continue;
    if (e.managerRole === 'Regional Manager') {
      e.manager_id = regionals[REGION_ORDER.indexOf(storeRegion.get(e.location_id!)!)].employee_id;
      continue;
    }
    const scope = e.managerRole === 'Executive' || e.department === 'Corporate' ? null : e.location_id;
    const at = Math.min(e.term ?? AS_OF, AS_OF);
    let mgr = activeAt(scope, [e.managerRole], at).filter((m) => m !== e);
    if (!mgr.length) mgr = list.filter((m) => m.location_id === scope && m.role === e.managerRole && m !== e);
    // Prefer whoever was manager at the reference date; ties -> longest tenured.
    mgr.sort((a, b) => a.hire - b.hire);
    e.manager_id = mgr.length ? mgr[0].employee_id : null;
  }

  return {
    employees: list,
    activeAt: (storeId, roles, d) => activeAt(storeId, roles, d),
    pickActive(r, storeId, roles, d) {
      const pool = activeAt(storeId, roles, d);
      if (pool.length) return r.pick(pool);
      const any = list.filter((e) => e.location_id === storeId && roles.includes(e.role));
      // nearest by hire date
      any.sort((a, b) => Math.abs(a.hire - d) - Math.abs(b.hire - d));
      return any[0];
    },
  };
}

