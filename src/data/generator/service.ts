import { day, monthOf, type Day } from './dates';
import type { EmployeeWorld } from './employees';
import type { CustomerBook } from './crm';
import { JOBS, STORES, type JobTemplate } from './reference';
import { round1, round2, stream, type Rng } from './rng';
import type { Customer, Deal, Unit, WorkOrder } from './types';

const START = day('2024-07-01');
const AS_OF = day('2026-06-30');

/** Outside customer-pay traffic by month: de-winterize in spring, winterize in fall. */
const CP_SEASON = [0, 0.6, 0.7, 1.2, 1.45, 1.3, 1.0, 0.9, 0.85, 1.1, 1.35, 0.95, 0.55];

function cpJobFor(rng: Rng, d: Day): JobTemplate {
  const m = monthOf(d);
  const pool = JOBS['Customer Pay'];
  const find = (code: string) => pool.find((j) => j.code === code)!;
  if ([10, 11].includes(m) && rng.chance(0.45)) return find('CP-WINTER');
  if ([3, 4, 5].includes(m) && rng.chance(0.4)) return find('CP-DEWINTER');
  if ([6, 7, 8].includes(m) && rng.chance(0.25)) return find('CP-AC');
  return rng.pick(pool.filter((j) => j.code !== 'CP-WINTER' && j.code !== 'CP-DEWINTER'));
}

export function generateService(
  seed: number,
  units: Unit[],
  deals: Deal[],
  emp: EmployeeWorld,
  book: CustomerBook,
): WorkOrder[] {
  const rng = stream(seed, 'service');
  const wos: WorkOrder[] = [];

  const addWo = (
    storeId: number,
    bill: WorkOrder['bill_type'],
    opened: Day,
    daysOpen: number,
    customer: Customer | null,
    unit: Unit | null,
    templates: JobTemplate[],
  ) => {
    const store = STORES[storeId - 1];
    const closedDay = opened + daysOpen;
    const closed = closedDay <= AS_OF ? closedDay : null;
    const wo: WorkOrder = {
      wo_number: 0,
      location_id: storeId,
      customer,
      unit,
      bill_type: bill,
      opened,
      closed,
      status: closed ? 'Closed' : rng.chance(0.3) ? 'Waiting on Parts' : 'Open',
      advisor_id: rng.chance(0.01) ? -1 : emp.pickActive(rng, storeId, ['Service Advisor'], opened).employee_id,
      jobs: [],
    };
    const rate = bill === 'Customer Pay' ? store.doorRate : bill === 'Warranty' ? Math.round(store.doorRate * 0.82) : Math.round(store.doorRate * 0.6);
    for (const t of templates) {
      const tech = emp.pickActive(rng, storeId, ['Technician'], opened);
      const flag = round1(rng.float(t.flag[0], t.flag[1]));
      const actual = Math.max(0.1, round1((flag / tech.efficiency) * rng.float(0.85, 1.15)));
      const parts_cost = round2(rng.float(t.parts[0], t.parts[1]));
      const markup = bill === 'Customer Pay' ? rng.float(1.55, 1.9) : bill === 'Warranty' ? 1.3 : 1;
      wo.jobs.push({
        job_id: 0,
        job_code: t.code,
        description: t.description,
        flag_hours: flag,
        actual_hours: actual,
        labor_rate: rate,
        parts_cost,
        parts_sale: round2(parts_cost * markup),
        technician_id: tech.employee_id,
      });
    }
    wos.push(wo);
    return wo;
  };

  // Internal: PDI on every new unit, recon on every used unit.
  for (const u of units) {
    if (u.received === null) continue;
    const opened = u.received + rng.int(0, 3);
    if (opened < START - 30) continue;
    if (u.condition === 'New') {
      const jobs = [JOBS.PDI[0]];
      if (rng.chance(0.5)) jobs.push(JOBS.PDI[1]);
      addWo(u.location_id, 'Internal', opened, rng.int(1, 6), null, u, jobs);
    } else {
      const n = rng.int(1, 3);
      const jobs = rng.shuffle([...JOBS.Recon]).slice(0, n);
      if (!jobs.some((j) => j.code === 'RECON-DET')) jobs.push(JOBS.Recon[0]);
      addWo(u.location_id, 'Internal', opened, rng.int(3, 20), null, u, jobs);
    }
  }

  // Warranty and customer-pay visits from our own buyers.
  for (const d of deals) {
    if (d.deal_status !== 'Funded') continue;
    if (d.unit.condition === 'New') {
      let visits = rng.chance(0.35) ? 1 : 0;
      if (visits && rng.chance(0.25)) visits++;
      for (let i = 0; i < visits; i++) {
        const opened = d.day + rng.int(20, 340);
        if (opened > AS_OF) continue;
        addWo(d.location_id, 'Warranty', opened, rng.int(2, 25), d.customer, d.unit, rng.shuffle([...JOBS.Warranty]).slice(0, rng.int(1, 2)));
      }
    }
    if (rng.chance(0.4)) {
      const opened = d.day + rng.int(60, 500);
      if (opened <= AS_OF) {
        const jobs = [cpJobFor(rng, opened)];
        if (rng.chance(0.3)) jobs.push(cpJobFor(rng, opened));
        addWo(d.location_id, 'Customer Pay', opened, rng.int(1, 10), d.customer, d.unit, dedupe(jobs));
      }
    }
  }

  // Outside customer-pay traffic (RVs we didn't sell).
  for (const store of STORES) {
    for (let d = START; d <= AS_OF; d++) {
      const lambda = 0.62 * store.size * CP_SEASON[monthOf(d)];
      let n = 0;
      for (let p = Math.exp(-lambda), s = p, r = rng.next(); r > s; ) {
        n++;
        p *= lambda / n;
        s += p;
      }
      for (let i = 0; i < n; i++) {
        const cust = (rng.chance(0.45) ? book.existingAt(rng, store.id, d) : null) ?? book.newCustomer(rng, store.id, d);
        const jobs = [cpJobFor(rng, d)];
        if (rng.chance(0.35)) jobs.push(cpJobFor(rng, d));
        if (rng.chance(0.1)) jobs.push(cpJobFor(rng, d));
        addWo(store.id, 'Customer Pay', d, rng.int(1, 12), cust, null, dedupe(jobs));
      }
    }
  }

  // WO numbers restart per store (hence the composite key).
  wos.sort((a, b) => a.opened - b.opened || a.location_id - b.location_id);
  const next = new Map<number, number>();
  for (const wo of wos) {
    const n = next.get(wo.location_id) ?? 10001;
    wo.wo_number = n;
    next.set(wo.location_id, n + 1);
  }
  let jobId = 1;
  for (const wo of wos) for (const j of wo.jobs) j.job_id = jobId++;

  // Recon cost on the unit = labor + parts from its internal work orders.
  const recon = new Map<Unit, number>();
  for (const wo of wos) {
    if (wo.bill_type !== 'Internal' || !wo.unit) continue;
    const cost = wo.jobs.reduce((s, j) => s + j.flag_hours * j.labor_rate + j.parts_sale, 0);
    recon.set(wo.unit, (recon.get(wo.unit) ?? 0) + cost);
  }
  for (const u of units) u.recon_cost = round2(recon.get(u) ?? 0);

  return wos;
}

function dedupe(jobs: JobTemplate[]): JobTemplate[] {
  return [...new Set(jobs)];
}

