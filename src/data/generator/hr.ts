import { addYears, day, iso } from './dates';
import { TRAINING_COURSES } from './reference';
import { round2, stream } from './rng';
import type { Employee, Row } from './types';

const START = day('2024-07-01');
const AS_OF = day('2026-06-30');

const PAY: Record<string, { type: 'Hourly' | 'Salary' | 'Commission+Draw'; range: [number, number] }> = {
  Executive: { type: 'Salary', range: [240_000, 260_000] },
  'Regional Manager': { type: 'Salary', range: [148_000, 176_000] },
  'General Manager': { type: 'Salary', range: [128_000, 188_000] },
  'Sales Manager': { type: 'Salary', range: [84_000, 118_000] },
  Sales: { type: 'Commission+Draw', range: [2_000, 3_000] },
  'F&I Manager': { type: 'Commission+Draw', range: [3_500, 5_000] },
  'Service Manager': { type: 'Salary', range: [78_000, 104_000] },
  'Service Advisor': { type: 'Hourly', range: [21, 28] },
  Technician: { type: 'Hourly', range: [26, 45] },
  Parts: { type: 'Hourly', range: [19, 25] },
  Porter: { type: 'Hourly', range: [15.5, 19] },
  Controller: { type: 'Salary', range: [135_000, 145_000] },
  HR: { type: 'Salary', range: [68_000, 96_000] },
  'Data Engineer': { type: 'Salary', range: [108_000, 140_000] },
  'Data Analyst': { type: 'Salary', range: [74_000, 94_000] },
  'Data Scientist': { type: 'Salary', range: [118_000, 150_000] },
};

export function generateHr(seed: number, employees: Employee[]) {
  const rng = stream(seed, 'hr');
  const pay: Row[] = [];
  const timeOff: Row[] = [];
  const training: Row[] = [];

  for (const e of employees) {
    const p = PAY[e.role];
    const end = Math.min(e.term ?? AS_OF, AS_OF);
    let rate = rng.float(p.range[0], p.range[1]);
    if (e.first_name === 'Earl' && e.last_name === 'Buckley') rate = 52;
    const roundRate = (r: number) => (p.type === 'Hourly' ? round2(r) : Math.round(r / 100) * 100);
    pay.push({ employee_id: e.employee_id, effective_date: iso(e.hire), pay_type: p.type, rate: roundRate(rate) });
    for (let y = 1; ; y++) {
      const eff = addYears(e.hire, y);
      if (eff > end) break;
      if (!rng.chance(0.7)) continue;
      rate *= 1 + rng.float(0.02, 0.05);
      pay.push({ employee_id: e.employee_id, effective_date: iso(eff), pay_type: p.type, rate: roundRate(rate) });
    }

    // Time off inside the window.
    const from = Math.max(e.hire, START);
    if (from < end) {
      const years = (end - from) / 365;
      const requests = Math.round(years * rng.float(1.5, 4.5));
      for (let i = 0; i < requests; i++) {
        const start = rng.int(from, Math.min(end + 30, AS_OF + 30));
        const type = rng.weighted<string>([['PTO', 70], ['Sick', 22], ['Unpaid', 4], ['Bereavement', 2], ['Jury Duty', 2]]);
        const days = type === 'PTO' ? rng.int(1, 5) : rng.int(1, 2);
        const status = start > AS_OF ? 'Pending' : rng.chance(0.06) ? 'Denied' : 'Approved';
        timeOff.push({
          time_off_id: 0,
          employee_id: e.employee_id,
          start_date: iso(start),
          end_date: iso(start + days - 1),
          time_off_type: type,
          hours: days * (e.employment_type === 'Part-time' ? 5 : 8),
          status,
          _sort: start,
        });
      }
    }

    // Training: required courses within ~30 days of hire (or of the window start),
    // plus annual refreshers for the "all staff" courses. ~8% are overdue.
    const courses = TRAINING_COURSES.filter((c) => c.roles === 'all' || c.roles.includes(e.role));
    for (const c of courses) {
      if (rng.chance(0.08)) continue;
      const base = Math.max(e.hire, START - 200);
      const firstDone = base + rng.int(3, 35);
      const dates = [firstDone];
      if (c.roles === 'all') for (let t = addYears(firstDone, 1); t <= end; t = addYears(t, 1)) dates.push(t + rng.int(-10, 20));
      for (const d of dates) {
        if (d > end || d > AS_OF) continue;
        training.push({ employee_id: e.employee_id, course: c.course, completed_date: iso(d), score: rng.int(70, 100) });
      }
    }
  }

  timeOff.sort((a, b) => (a._sort as number) - (b._sort as number) || (a.employee_id as number) - (b.employee_id as number));
  timeOff.forEach((t, i) => {
    t.time_off_id = 90001 + i;
    delete t._sort;
  });
  pay.sort((a, b) => (a.employee_id as number) - (b.employee_id as number) || String(a.effective_date).localeCompare(String(b.effective_date)));
  // de-duplicate any accidental same-day training rows (the PK is employee+course+date)
  const seen = new Set<string>();
  const trainingUnique = training.filter((t) => {
    const k = `${t.employee_id}|${t.course}|${t.completed_date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { pay, timeOff, training: trainingUnique };
}

