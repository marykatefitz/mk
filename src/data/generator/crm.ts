import { day, isoTimestamp, monthOf, type Day } from './dates';
import type { EmployeeWorld } from './employees';
import {
  CLASS_MIX,
  FIRST_NAMES,
  LAST_NAMES,
  LEAD_SOURCES,
  SOURCE_PROFILE,
  STORES,
  type LeadSource,
} from './reference';
import { stream, type Rng } from './rng';
import type { Customer, Deal, Lead } from './types';

const START = day('2024-07-01');
const AS_OF = day('2026-06-30');
export const MIGRATION_DAY = day('2025-03-08');

/** Lead volume by month: RV-show season (Jan–Mar) and spring are busy. */
const LEAD_SEASON = [0, 1.3, 1.4, 1.35, 1.2, 1.05, 0.95, 0.85, 0.8, 0.8, 0.8, 0.7, 0.65];

export interface CustomerBook {
  customers: Customer[];
  newCustomer(rng: Rng, storeId: number, created: Day): Customer;
  existingAt(rng: Rng, storeId: number, before: Day): Customer | null;
}

export function customerBook(): CustomerBook {
  const customers: Customer[] = [];
  const byStore = new Map<number, Customer[]>();
  return {
    customers,
    newCustomer(rng, storeId, created) {
      let store = STORES[storeId - 1];
      if (rng.chance(0.08)) store = rng.pick(STORES);
      const c: Customer = {
        customer_id: 0,
        first_name: rng.pick(FIRST_NAMES),
        last_name: rng.pick(LAST_NAMES),
        city: rng.pick(store.cities),
        state: store.state,
        created,
        storeId,
      };
      customers.push(c);
      if (!byStore.has(storeId)) byStore.set(storeId, []);
      byStore.get(storeId)!.push(c);
      return c;
    },
    existingAt(rng, storeId, before) {
      const pool = byStore.get(storeId);
      if (!pool?.length) return null;
      // Customers are appended roughly chronologically; sample a few and keep one that existed.
      for (let i = 0; i < 6; i++) {
        const c = rng.pick(pool);
        if (c.created <= before) return c;
      }
      return null;
    },
  };
}

function seasonalDay(rng: Rng, from: Day, to: Day): Day {
  for (;;) {
    const d = rng.int(from, to);
    if (rng.next() * 1.4 < LEAD_SEASON[monthOf(d)]) return d;
  }
}

export function generateCrm(seed: number, deals: Deal[], emp: EmployeeWorld, book: CustomerBook): Lead[] {
  const rng = stream(seed, 'crm');
  const leads: Lead[] = [];

  // 1) Every deal gets a customer; ~80% also have a CRM lead that turned into the sale.
  const soldBySource = new Map<LeadSource, number>();
  const soldShare = LEAD_SOURCES.map((s) => [s, SOURCE_PROFILE[s].soldShare] as const);
  for (const deal of deals) {
    const hasLead = rng.chance(0.8);
    if (!hasLead) {
      const repeat = rng.chance(0.1) ? book.existingAt(rng, deal.location_id, deal.day) : null;
      deal.customer = repeat ?? book.newCustomer(rng, deal.location_id, deal.day);
      continue;
    }
    const source = rng.weighted(soldShare);
    soldBySource.set(source, (soldBySource.get(source) ?? 0) + 1);
    deal.leadSource = source;
    const created = Math.max(START - 45, deal.day - Math.min(150, Math.round(rng.logNormal(source === 'Walk-in' ? 3 : 18, 0.9))));
    const repeat = rng.chance(0.12) ? book.existingAt(rng, deal.location_id, created) : null;
    const cust = repeat ?? book.newCustomer(rng, deal.location_id, created);
    deal.customer = cust;
    const lead: Lead = {
      lead_id: 0,
      lead_number: '',
      customer: cust,
      deal,
      location_id: deal.location_id,
      source,
      created,
      rv_class_interest: rng.chance(0.85) ? deal.unit.rv_class : rng.weighted(CLASS_MIX),
      status: deal.deal_status === 'Unwound' ? 'Lost' : 'Sold',
      assigned_employee_id: deal.salesperson_id === -1 ? emp.pickActive(rng, deal.location_id, ['Sales'], created).employee_id : deal.salesperson_id,
      updated_at: isoTimestamp(deal.day, rng.int(9 * 60, 19 * 60)),
      isMigrationCopy: false,
    };
    leads.push(lead);
  }

  // 2) Leads that never bought, sized so each source hits its close rate.
  const totalSize = STORES.reduce((s, st) => s + st.size, 0);
  const storeWeights = STORES.map((s) => [s.id, s.size / totalSize] as const);
  for (const source of LEAD_SOURCES) {
    const sold = soldBySource.get(source) ?? 0;
    const total = Math.round(sold / SOURCE_PROFILE[source].closeRate);
    for (let i = sold; i < total; i++) {
      const storeId = rng.weighted(storeWeights);
      const created = seasonalDay(rng, START, AS_OF);
      const age = AS_OF - created;
      let status: Lead['status'];
      if (age <= 30) status = rng.weighted<Lead['status']>([['New', 35], ['Working', 40], ['Appointment Set', 25]]);
      else if (age <= 90) status = rng.weighted<Lead['status']>([['Working', 20], ['Appointment Set', 10], ['Lost', 70]]);
      else status = 'Lost';
      const repeat = rng.chance(0.25) ? book.existingAt(rng, storeId, created) : null;
      const cust = repeat ?? book.newCustomer(rng, storeId, created);
      const lastTouch = status === 'Lost' ? Math.min(AS_OF, created + rng.int(14, 75)) : rng.int(created, AS_OF);
      const lead: Lead = {
        lead_id: 0,
        lead_number: '',
        customer: cust,
        deal: null,
        location_id: storeId,
        source,
        created,
        rv_class_interest: rng.weighted(CLASS_MIX),
        status,
        assigned_employee_id: emp.pickActive(rng, storeId, ['Sales'], created).employee_id,
        updated_at: isoTimestamp(lastTouch, rng.int(8 * 60, 20 * 60)),
        isMigrationCopy: false,
      };
      leads.push(lead);
    }
  }

  // 3) Lead IDs and numbers by created date. Unknown-owner sentinels (-1).
  leads.sort((a, b) => a.created - b.created || a.location_id - b.location_id);
  leads.forEach((l, i) => {
    l.lead_id = 1 + i;
    l.lead_number = `LD-${100001 + i}`;
    if (l.deal) l.deal.lead_id = l.lead_id;
    if (rng.chance(0.03)) l.assigned_employee_id = -1;
  });

  // 4) The March 2025 CRM migration re-inserted ~4% of older leads with new lead_ids and
  //    stale data. The original row (lowest lead_id) is the true one.
  const eligible = leads.filter((l) => l.created < MIGRATION_DAY);
  const copies: Lead[] = [];
  let nextId = leads.length + 1;
  for (const l of eligible) {
    if (!rng.chance(0.1)) continue;
    const stale: Lead['status'] =
      l.status === 'Sold' ? rng.pick(['Working', 'Appointment Set'] as const) : l.status === 'Lost' ? rng.pick(['Working', 'New'] as const) : l.status;
    copies.push({
      ...l,
      deal: null,
      lead_id: nextId++,
      created: rng.chance(0.3) ? l.created + 1 : l.created,
      source: rng.chance(0.15) ? (l.source === 'Website' ? 'Third-party marketplace' : l.source) : l.source,
      status: stale,
      assigned_employee_id: rng.chance(0.25) ? emp.pickActive(rng, l.location_id, ['Sales'], l.created).employee_id : l.assigned_employee_id,
      updated_at: isoTimestamp(MIGRATION_DAY, 2 * 60 + rng.int(0, 90)),
      isMigrationCopy: true,
    });
  }
  return [...leads, ...copies];
}
