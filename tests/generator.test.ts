import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateDataset } from '../src/data/generator';
import { TABLES } from '../src/data/schema';
import type { SqlEngine } from '../src/engines/types';
import { dataset, loadedEngine, scalar } from './helpers';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

describe('data generator: determinism', () => {
  it('same seed gives byte-identical tables', () => {
    expect(hash(generateDataset().tables)).toBe(hash(dataset().tables));
  });

  it('a different seed gives different data', () => {
    expect(hash(generateDataset(7).tables)).not.toBe(hash(dataset().tables));
  });

  it('every table has exactly the schema columns, in order', () => {
    for (const def of TABLES) {
      const rows = dataset().tables[def.name];
      expect(rows.length, def.name).toBeGreaterThan(0);
      expect(Object.keys(rows[0])).toEqual(def.columns.map((c) => c.name));
    }
  });

  it('volumes are in the intended ranges', () => {
    const n = (t: string) => dataset().tables[t].length;
    expect(n('locations')).toBe(12);
    expect(n('units')).toBeGreaterThan(1350);
    expect(n('units')).toBeLessThan(1700);
    expect(n('deals')).toBeGreaterThan(1000);
    expect(n('leads')).toBeGreaterThan(8000);
    expect(n('work_orders')).toBeGreaterThan(6000);
    expect(n('wo_jobs')).toBeGreaterThan(n('work_orders'));
    expect(n('curtailments')).toBeGreaterThan(500);
  });
});

describe('data generator: loaded into DuckDB', () => {
  let e: SqlEngine;
  beforeAll(async () => {
    e = await loadedEngine(); // PRIMARY KEY constraints are enforced during load
  });
  afterAll(() => e.close());

  it('as_of_date() is 2026-06-30', async () => {
    const r = await e.query('select as_of_date()');
    expect(r.rows[0][0]).toBe('2026-06-30');
  });

  it('core relationships hold (outside the planted problems)', async () => {
    expect(await scalar(e, 'select count(*) from deals d anti join units u using (stock_no)')).toBe(0);
    expect(await scalar(e, 'select count(*) from floorplan_loans f anti join units u using (stock_no)')).toBe(0);
    expect(await scalar(e, 'select count(*) from curtailments c anti join floorplan_loans f using (floorplan_id)')).toBe(0);
    expect(await scalar(e, 'select count(*) from fi_products p anti join deals d using (deal_id)')).toBe(0);
    expect(await scalar(e, 'select count(*) from deals d where lead_id is not null and lead_id not in (select lead_id from leads)')).toBe(0);
    expect(await scalar(e, 'select count(*) from deals where trade_in_stock_no is not null and trade_in_stock_no not in (select stock_no from units)')).toBe(0);
    expect(await scalar(e, 'select count(*) from employees where manager_id is not null and manager_id not in (select employee_id from employees)')).toBe(0);
    expect(await scalar(e, "select count(*) from employees where manager_id is null")).toBe(1);
  });

  it('plants the messy-data lessons', async () => {
    expect(await scalar(e, 'select count(*) - count(distinct lead_number) from leads')).toBeGreaterThan(200);
    expect(await scalar(e, 'select count(*) from deals where salesperson_id = -1')).toBeGreaterThan(5);
    expect(await scalar(e, 'select count(*) from leads where assigned_employee_id = -1')).toBeGreaterThan(100);
    expect(await scalar(e, 'select count(*) from work_orders where advisor_id = -1')).toBeGreaterThan(5);
    expect(await scalar(e, 'select count(*) from wo_jobs j anti join work_orders w using (wo_number, location_id)')).toBe(15);
    expect(await scalar(e, 'select count(*) from deals d anti join customers c using (customer_id)')).toBe(5);
    expect(await scalar(e, "select count(*) from units where received_date is null and status <> 'In Transit'")).toBe(10);
    expect(await scalar(e, "select count(*) from work_orders where status = 'Closed' and closed_date is null")).toBe(20);
    expect(
      await scalar(
        e,
        `select count(*) from units u
         where coalesce(u.recon_cost, 0) = 0
           and exists (select 1 from work_orders w where w.stock_no = u.stock_no and w.bill_type = 'Internal')
           and u.condition = 'Used'`,
      ),
    ).toBe(120);
  });

  it('the original lead (lowest lead_id) is the Sold one, the migration copy is stale', async () => {
    const stale = await scalar(
      e,
      `select count(*) from (
         select lead_number, status, row_number() over (partition by lead_number order by lead_id) rn
         from leads qualify count(*) over (partition by lead_number) > 1
       ) where rn = 2 and status = 'Sold'`,
    );
    expect(stale).toBe(0);
  });

  it('stores tell the intended story for the ops review', async () => {
    const worstAging = await e.query(`
      select l.location_name from units u join locations l using (location_id)
      where u.status = 'In Stock' and u.received_date is not null
      group by 1 order by avg(case when as_of_date() - u.received_date > 180 then 1 else 0 end) desc limit 1`);
    expect(worstAging.rows[0][0]).toBe('Boise');
    const exposure = await e.query(`
      select l.location_name from curtailments c join floorplan_loans f using (floorplan_id)
      join units u using (stock_no) join locations l using (location_id)
      where c.paid_date is null and c.due_date <= as_of_date() + 60
      group by 1 order by sum(c.amount_due - c.amount_paid) desc limit 1`);
    expect(exposure.rows[0][0]).toBe('Phoenix');
    const weakFi = await e.query(`
      select l.location_name from deals d join locations l using (location_id)
      left join (select deal_id, sum(sale_price - cost) be from fi_products group by 1) f using (deal_id)
      where d.deal_status = 'Funded' group by 1 order by sum(coalesce(f.be, 0)) / count(*) limit 1`);
    expect(weakFi.rows[0][0]).toBe('Tucson');
  });

  it('Earl really is the most efficient tech', async () => {
    const r = await e.query(`
      select e.first_name || ' ' || e.last_name from wo_jobs j join employees e on e.employee_id = j.technician_id
      group by 1 having count(*) > 50 order by sum(flag_hours) / sum(actual_hours) desc limit 1`);
    expect(r.rows[0][0]).toBe('Earl Buckley');
  });
});
