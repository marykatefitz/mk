import { TABLES } from '../schema';
import { customerBook, generateCrm } from './crm';
import { iso } from './dates';
import { generateEmployees } from './employees';
import { generateHr } from './hr';
import { generateInventory } from './inventory';
import { STORES } from './reference';
import { round2, stream } from './rng';
import { generateService } from './service';
import type { Dataset, Row, Unit } from './types';

export const DEFAULT_SEED = 20240701;

/**
 * Build the whole Summit Trail RV database. Pure and deterministic:
 * the same seed always yields byte-identical tables.
 */
export function generateDataset(seed = DEFAULT_SEED): Dataset {
  const emp = generateEmployees(seed);
  const inv = generateInventory(seed, emp);
  const book = customerBook();
  const leads = generateCrm(seed, inv.deals, emp, book);
  const wos = generateService(seed, inv.units, inv.deals, emp, book);
  const hr = generateHr(seed, emp.employees);
  const mess = stream(seed, 'messiness');

  // ---- Planted data-quality problems ---------------------------------------------
  // Recon drift: internal WOs exist, but the cost never made it onto the unit.
  const drift = mess.shuffle(inv.units.filter((u) => u.condition === 'Used' && (u.recon_cost ?? 0) > 0)).slice(0, 120);
  drift.forEach((u, i) => (u.recon_cost = i % 2 === 0 ? null : 0));

  // Front gross is computed from what accounting *thinks* recon was (so drift overstates it).
  for (const d of inv.deals) {
    const overAllowance = d.trade ? d.trade_allowance! - d.trade_acv! : 0;
    d.front_gross = round2(d.sale_price - d.unit.invoice_cost - (d.unit.recon_cost ?? 0) - overAllowance);
  }

  // Missing received dates on a few records that should have one.
  const noReceived = new Set<Unit>(
    mess.shuffle(inv.units.filter((u) => u.received !== null && u.status !== 'In Transit')).slice(0, 10),
  );
  // Closed work orders that lost their closed_date.
  const closedNoDate = new Set(mess.shuffle(wos.filter((w) => w.status === 'Closed')).slice(0, 20));

  // Customer IDs in creation order.
  book.customers.sort((a, b) => a.created - b.created);
  book.customers.forEach((c, i) => (c.customer_id = 30001 + i));
  const maxCustomer = 30000 + book.customers.length;
  // Orphan deals: customer IDs that don't exist (deleted in a CRM cleanup).
  const orphanDeals = new Set(mess.shuffle(inv.deals.filter((d) => d.deal_status === 'Funded')).slice(0, 5));

  // ---- Project to rows ------------------------------------------------------------
  const t: Record<string, Row[]> = {};

  t.locations = STORES.map((s) => ({
    location_id: s.id,
    location_name: s.name,
    region: s.region,
    state: s.state,
    opened_date: s.opened,
  }));

  const unitsSorted = [...inv.units].sort((a, b) => a.stock_no.localeCompare(b.stock_no));
  t.units = unitsSorted.map((u) => ({
    stock_no: u.stock_no,
    vin: u.vin,
    model_year: u.model_year,
    manufacturer: u.manufacturer,
    model: u.model,
    rv_class: u.rv_class,
    condition: u.condition,
    location_id: u.location_id,
    received_date: u.received === null || noReceived.has(u) ? null : iso(u.received),
    msrp: u.msrp,
    invoice_cost: u.invoice_cost,
    recon_cost: u.recon_cost,
    status: u.status,
  }));

  t.floorplan_loans = inv.floorplans.map((f) => ({
    floorplan_id: f.floorplan_id,
    stock_no: f.unit.stock_no,
    lender: f.lender,
    funded_date: iso(f.funded),
    funded_amount: f.funded_amount,
    interest_rate: f.interest_rate,
    paid_off_date: f.paid_off === null ? null : iso(f.paid_off),
  }));

  t.curtailments = inv.curtailments.map((c) => ({
    curtailment_id: c.curtailment_id,
    floorplan_id: c.floorplan_id,
    due_date: iso(c.due),
    curtailment_pct: c.pct,
    amount_due: c.amount_due,
    amount_paid: c.amount_paid,
    paid_date: c.paid === null ? null : iso(c.paid),
  }));

  t.customers = book.customers.map((c) => ({
    customer_id: c.customer_id,
    first_name: c.first_name,
    last_name: c.last_name,
    city: c.city,
    state: c.state,
    created_date: iso(c.created),
  }));

  t.leads = leads
    .map((l) => ({
      lead_id: l.lead_id,
      lead_number: l.lead_number,
      customer_id: l.customer.customer_id,
      location_id: l.location_id,
      source: l.source,
      created_date: iso(l.created),
      rv_class_interest: l.rv_class_interest,
      status: l.status,
      assigned_employee_id: l.assigned_employee_id,
      updated_at: l.updated_at,
    }))
    .sort((a, b) => a.lead_id - b.lead_id);

  let orphanCustomer = maxCustomer + 400;
  t.deals = inv.deals.map((d) => ({
    deal_id: d.deal_id,
    stock_no: d.unit.stock_no,
    customer_id: orphanDeals.has(d) ? (orphanCustomer += 37) : d.customer!.customer_id,
    lead_id: d.lead_id,
    location_id: d.location_id,
    salesperson_id: d.salesperson_id,
    deal_date: iso(d.day),
    sale_price: d.sale_price,
    trade_in_stock_no: d.trade?.stock_no ?? null,
    trade_allowance: d.trade_allowance,
    trade_acv: d.trade_acv,
    down_payment: d.down_payment,
    finance_type: d.finance_type,
    lender: d.lender,
    apr: d.apr,
    term_months: d.term_months,
    amount_financed: d.amount_financed,
    front_gross: d.front_gross,
    deal_status: d.deal_status,
  }));

  t.fi_products = inv.deals.flatMap((d) =>
    d.products.map((p) => ({ deal_id: d.deal_id, product: p.product, sale_price: p.sale_price, cost: p.cost })),
  );

  t.employees = emp.employees.map((e) => ({
    employee_id: e.employee_id,
    first_name: e.first_name,
    last_name: e.last_name,
    role: e.role,
    department: e.department,
    location_id: e.location_id,
    manager_id: e.manager_id,
    hire_date: iso(e.hire),
    termination_date: e.term === null ? null : iso(e.term),
    termination_reason: e.termination_reason,
    employment_type: e.employment_type,
  }));

  t.pay_history = hr.pay;
  t.time_off = hr.timeOff;
  t.training_completions = hr.training;

  t.work_orders = wos
    .map((w) => ({
      wo_number: w.wo_number,
      location_id: w.location_id,
      customer_id: w.customer?.customer_id ?? null,
      stock_no: w.unit?.stock_no ?? null,
      bill_type: w.bill_type,
      opened_date: iso(w.opened),
      closed_date: w.closed === null || closedNoDate.has(w) ? null : iso(w.closed),
      status: w.status,
      advisor_id: w.advisor_id,
    }))
    .sort((a, b) => a.location_id - b.location_id || a.wo_number - b.wo_number);

  t.wo_jobs = wos.flatMap((w) =>
    w.jobs.map((j) => ({
      job_id: j.job_id,
      wo_number: w.wo_number,
      location_id: w.location_id,
      job_code: j.job_code,
      description: j.description,
      flag_hours: j.flag_hours,
      actual_hours: j.actual_hours,
      labor_rate: j.labor_rate,
      parts_cost: j.parts_cost,
      parts_sale: j.parts_sale,
      technician_id: j.technician_id,
    })),
  );
  t.wo_jobs.sort((a, b) => (a.job_id as number) - (b.job_id as number));
  // Orphan job lines whose work-order header was purged.
  let nextJob = t.wo_jobs.length + 1;
  const donors = mess.shuffle([...t.wo_jobs]).slice(0, 15);
  for (const d of donors) {
    t.wo_jobs.push({ ...d, job_id: nextJob++, wo_number: 90000 + mess.int(1, 9999) });
  }

  // Guarantee column order matches the schema exactly.
  for (const def of TABLES) {
    t[def.name] = t[def.name].map((r) => Object.fromEntries(def.columns.map((c) => [c.name, r[c.name] ?? null])));
  }

  return { seed, tables: t };
}
