import { day, monthOf, yearOf, type Day } from './dates';
import type { EmployeeWorld } from './employees';
import {
  BRANDS,
  CLASS_MIX,
  FI_PRODUCTS,
  FLOORPLAN_CODES,
  FLOORPLAN_LENDERS,
  MSRP_RANGE,
  OUTSIDE_LENDERS,
  RETAIL_LENDERS,
  STORES,
  type RvClass,
  type StoreProfile,
} from './reference';
import { round2, stream, type Rng } from './rng';
import type { Deal, Unit } from './types';

const START = day('2024-07-01');
const AS_OF = day('2026-06-30');
const HISTORY_FROM = day('2023-09-01');

/** Seasonal weight for new-unit arrivals (dealers stock up for spring). */
const ARRIVAL_SEASON = [0, 1.25, 1.3, 1.3, 1.1, 0.9, 0.8, 0.75, 0.85, 1.0, 1.05, 0.85, 0.8];

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const YEAR_CODES: Record<number, string> = {
  2012: 'C', 2013: 'D', 2014: 'E', 2015: 'F', 2016: 'G', 2017: 'H', 2018: 'J', 2019: 'K',
  2020: 'L', 2021: 'M', 2022: 'N', 2023: 'P', 2024: 'R', 2025: 'S', 2026: 'T', 2027: 'V',
};
const WMI: Record<string, string> = {
  'Pinecrest RV': '4PC', 'Aspen Hollow': '5AH', 'Driftwood Coachworks': '1DW', 'Sagebrush Mfg': '4SB',
  'Tamarack Industries': '1TM', 'Canyon Crest Coach': '5CC', 'Bluewater Trails': '4BW',
};

export interface Floorplan {
  floorplan_id: number;
  unit: Unit;
  lender: string;
  funded: Day;
  funded_amount: number;
  interest_rate: number;
  paid_off: Day | null;
}

export interface Curtailment {
  curtailment_id: number;
  floorplan_id: number;
  due: Day;
  pct: number;
  amount_due: number;
  amount_paid: number;
  paid: Day | null;
}

export interface InventoryWorld {
  units: Unit[];
  deals: Deal[];
  floorplans: Floorplan[];
  curtailments: Curtailment[];
}

function classMixFor(store: StoreProfile): [RvClass, number][] {
  return CLASS_MIX.map(([c, w]) => [c, c.startsWith('Class') ? w * store.luxury : w]);
}

function seasonalDay(rng: Rng, from: Day, to: Day): Day {
  for (;;) {
    const d = rng.int(from, to);
    if (rng.next() * 1.3 < ARRIVAL_SEASON[monthOf(d)]) return d;
  }
}

function makeVin(rng: Rng, brand: string, year: number): string {
  let s = WMI[brand] ?? '4XX';
  for (let i = 0; i < 5; i++) s += rng.pick(VIN_CHARS.split(''));
  s += String(rng.int(0, 9)); // check digit (not validated)
  s += YEAR_CODES[year] ?? 'A';
  s += rng.pick(['F', 'G', 'K', 'W']); // plant
  s += String(rng.int(100000, 999999));
  return s;
}

function pickModel(rng: Rng, cls: RvClass): { manufacturer: string; model: string } {
  const brands = BRANDS.filter((b) => b.series[cls]);
  const brand = rng.pick(brands);
  return { manufacturer: brand.name, model: `${rng.pick(brand.series[cls]!)} ${rng.pick(FLOORPLAN_CODES[cls])}` };
}

export function generateInventory(seed: number, emp: EmployeeWorld): InventoryWorld {
  const rng = stream(seed, 'inventory');
  const units: Unit[] = [];
  const deals: Deal[] = [];
  let unitKey = 0;
  let dealKey = 0;

  const newUnit = (store: StoreProfile, received: Day | null, acquired: Day, origin: Unit['origin'], cls: RvClass): Unit => {
    const { manufacturer, model } = pickModel(rng, cls);
    const [lo, hi] = MSRP_RANGE[cls];
    const u: Unit = {
      key: unitKey++,
      stock_no: '',
      vin: '',
      model_year: 0,
      manufacturer,
      model,
      rv_class: cls,
      condition: origin === 'factory' ? 'New' : 'Used',
      location_id: store.id,
      received,
      acquired,
      msrp: 0,
      invoice_cost: 0,
      recon_cost: null,
      status: 'In Stock',
      origin,
      saleDay: null,
      wholesaleDay: null,
      deal: null,
    };
    if (origin === 'factory') {
      u.model_year = yearOf(acquired) + (monthOf(acquired) >= 7 ? 1 : 0) - (rng.chance(0.1) ? 1 : 0);
      u.msrp = Math.round(rng.float(lo, hi) / 100) * 100 - 1; // $xx,x99 pricing
      u.invoice_cost = round2(u.msrp * rng.float(0.72, 0.8));
    } else {
      const age = rng.int(1, 11);
      u.model_year = yearOf(acquired) - age;
      const acv = Math.round((((lo + hi) / 2) * Math.pow(0.9, age) * rng.float(0.45, 0.7)) / 100) * 100;
      u.invoice_cost = acv;
      u.msrp = Math.round((acv * rng.float(1.22, 1.38)) / 100) * 100 - 1;
    }
    u.vin = makeVin(rng, manufacturer, u.model_year);
    units.push(u);
    return u;
  };

  // --- Seed the lot: factory orders and auction buys --------------------------------
  const totalWeight = STORES.reduce((s, st) => s + st.size, 0);
  const work: Unit[] = [];
  for (const store of STORES) {
    const nNew = Math.round((1180 * store.size) / totalWeight);
    for (let i = 0; i < nNew; i++) {
      const received = seasonalDay(rng, HISTORY_FROM, AS_OF - 1);
      if (received > AS_OF - 210 && rng.next() > (store.recentArrivals ?? 1)) continue;
      work.push(newUnit(store, received, received - rng.int(3, 25), 'factory', rng.weighted(classMixFor(store))));
    }
    // A few units ordered but not yet on the lot.
    const nTransit = rng.int(0, 2);
    for (let i = 0; i < nTransit; i++) {
      const eta = AS_OF + rng.int(2, 20);
      const u = newUnit(store, null, eta - rng.int(15, 25), 'factory', rng.weighted(classMixFor(store)));
      u.status = 'In Transit';
    }
    const nAuction = Math.round((70 * store.size) / totalWeight);
    for (let i = 0; i < nAuction; i++) {
      const received = rng.int(HISTORY_FROM, AS_OF - 1);
      work.push(newUnit(store, received, received, 'auction', rng.weighted(classMixFor(store))));
    }
  }

  // --- Decide every unit's fate. Trades feed new used units back into the queue. ----
  while (work.length) {
    const u = work.shift()!;
    const store = STORES[u.location_id - 1];
    const received = u.received!;
    const median = u.condition === 'Used' ? store.medianDaysToSell * 0.75 : store.medianDaysToSell;
    let dts = Math.max(2, Math.round(rng.logNormal(median, 0.75)));
    let sale = received + dts;
    if ([11, 12, 1].includes(monthOf(sale)) && rng.chance(0.35)) sale += rng.int(45, 75);
    dts = sale - received;

    if (u.condition === 'Used' && dts > 200) {
      const wd = received + rng.int(200, 290);
      if (wd <= AS_OF && rng.chance(0.55)) {
        u.status = 'Wholesaled';
        u.wholesaleDay = wd;
        continue;
      }
    }
    if (sale > AS_OF) {
      u.status = u.condition === 'Used' && received > AS_OF - 21 && rng.chance(0.7) ? 'In Recon' : 'In Stock';
      continue;
    }
    if (sale < START) {
      // Sold before our history window; drop it (and never create its trade).
      u.status = 'Sold';
      u.saleDay = sale;
      continue;
    }
    deals.push(makeDeal(u, sale, dts, store));
  }

  function makeDeal(u: Unit, d: Day, dts: number, store: StoreProfile): Deal {
    let discount = u.condition === 'New' ? rng.float(0.1, 0.23) : rng.float(0.03, 0.12);
    if (dts > 180) discount += rng.float(0.02, 0.07);
    const sale_price = Math.round((u.msrp * (1 - discount)) / 10) * 10;

    let trade: Unit | null = null;
    let allowance: number | null = null;
    let acv: number | null = null;
    if (rng.chance(0.4)) {
      const towable = !u.rv_class.startsWith('Class');
      const cls = rng.weighted<RvClass>(
        towable
          ? [['Travel Trailer', 60], ['Fifth Wheel', 25], ['Toy Hauler', 10], ['Class C', 5]]
          : [['Class C', 30], ['Class A', 25], ['Travel Trailer', 20], ['Fifth Wheel', 15], ['Class B', 10]],
      );
      trade = newUnit(store, d, d, 'trade', cls);
      acv = trade.invoice_cost;
      const over = Math.round(rng.normal(1400, 1700) / 50) * 50;
      allowance = acv + Math.max(-1000, over);
      work.push(trade);
    }

    const finance_type = rng.weighted<Deal['finance_type']>([
      ['Cash', 22],
      ['Retail Finance', 63],
      ['Outside Finance', 15],
    ]);
    const deal: Deal = {
      key: dealKey++,
      deal_id: 0,
      unit: u,
      customer: null,
      lead_id: null,
      location_id: store.id,
      salesperson_id: emp.pickActive(rng, store.id, rng.chance(0.06) ? ['Sales Manager'] : ['Sales'], d).employee_id,
      day: d,
      sale_price,
      trade,
      trade_allowance: allowance,
      trade_acv: acv,
      down_payment: 0,
      finance_type,
      lender: null,
      apr: null,
      term_months: null,
      amount_financed: null,
      front_gross: 0,
      deal_status: 'Funded',
      products: [],
      leadSource: null,
    };
    if (rng.chance(0.02)) deal.salesperson_id = -1;

    // F&I products
    for (const p of FI_PRODUCTS) {
      if (p.financedOnly && finance_type !== 'Retail Finance') continue;
      let pen = p.penetration * store.fiStrength;
      if (finance_type === 'Cash') pen *= 0.55;
      if (finance_type === 'Retail Finance') pen *= 1.15;
      if (rng.chance(Math.min(0.95, pen))) {
        const price = Math.round(rng.float(p.price[0], p.price[1]) / 5) * 5;
        deal.products.push({ product: p.product, sale_price: price, cost: round2(price * rng.float(p.costPct[0], p.costPct[1])) });
      }
    }
    const fiTotal = deal.products.reduce((s, p) => s + p.sale_price, 0);
    const net = sale_price - (allowance ?? 0);
    if (finance_type === 'Cash') {
      deal.down_payment = Math.max(0, net + fiTotal);
    } else {
      deal.down_payment = Math.max(0, Math.round((net * rng.float(0.08, 0.25)) / 100) * 100);
      deal.lender = finance_type === 'Retail Finance' ? rng.pick(RETAIL_LENDERS) : rng.pick(OUTSIDE_LENDERS);
      deal.apr = round2(rng.float(6.49, 10.99));
      const financed = net - deal.down_payment + (finance_type === 'Retail Finance' ? fiTotal : 0);
      deal.amount_financed = round2(Math.max(0, financed));
      deal.term_months = rng.weighted<number>(
        deal.amount_financed > 100_000 ? [[180, 35], [240, 65]] : deal.amount_financed > 40_000 ? [[144, 30], [180, 50], [240, 20]] : [[120, 55], [144, 30], [180, 15]],
      );
      if (finance_type === 'Outside Finance') {
        // Products on outside-finance deals are paid in cash.
        deal.down_payment += fiTotal;
      }
    }

    if (d > AS_OF - 14 && rng.chance(0.65)) deal.deal_status = 'Pending';
    else if (rng.chance(0.03)) deal.deal_status = 'Unwound';

    if (deal.deal_status === 'Unwound') {
      u.status = 'In Stock';
    } else {
      u.status = 'Sold';
      u.saleDay = d;
    }
    u.deal = deal;
    return deal;
  }

  // Drop units that left before the history window; they never appear in any table.
  const kept = units.filter(
    (u) =>
      !(u.saleDay !== null && u.saleDay < START && u.status === 'Sold' && !u.deal) &&
      !(u.wholesaleDay !== null && u.wholesaleDay < START),
  );

  // --- Stock numbers: N/U + 2-digit year + group-wide sequence --------------------
  kept.sort((a, b) => a.acquired - b.acquired || a.key - b.key);
  const seq = new Map<string, number>();
  for (const u of kept) {
    const prefix = `${u.condition === 'New' ? 'N' : 'U'}${String(yearOf(u.acquired)).slice(2)}`;
    const n = (seq.get(prefix) ?? 0) + 1;
    seq.set(prefix, n);
    u.stock_no = `${prefix}-${String(n).padStart(5, '0')}`;
  }

  deals.sort((a, b) => a.day - b.day || a.key - b.key);
  deals.forEach((d, i) => (d.deal_id = 240001 + i));

  const { floorplans, curtailments } = generateFloorplan(seed, kept);
  return { units: kept, deals, floorplans, curtailments };
}

function generateFloorplan(seed: number, units: Unit[]) {
  const rng = stream(seed, 'floorplan');
  const floorplans: Floorplan[] = [];
  const curtailments: Curtailment[] = [];
  const baseRate: Record<string, number> = {
    'Ridgeline Commercial Finance': 7.25,
    'Blue Mesa Floorplan': 7.75,
    'Evergreen Dealer Capital': 7.5,
  };
  for (const u of units) {
    const store = STORES[u.location_id - 1];
    const floored = u.condition === 'New' || (u.origin !== 'trade' ? rng.chance(0.6) : rng.chance(0.3));
    if (!floored) continue;
    const funded = u.condition === 'New' ? u.acquired : u.acquired + rng.int(0, 10);
    if (funded > AS_OF) continue;
    const lender = rng.chance(0.85) ? store.floorplanLender : rng.pick(FLOORPLAN_LENDERS.filter((l) => l !== store.floorplanLender));
    const rateCut = funded >= day('2025-09-15') ? 0.5 : funded >= day('2024-12-01') ? 0.25 : 0;
    const rate = round2(baseRate[lender] - rateCut + rng.float(-0.25, 0.25));
    let paid: Day | null = null;
    if (u.status === 'Sold' && u.deal?.deal_status === 'Funded') paid = u.saleDay! + rng.int(1, 10);
    else if (u.status === 'Wholesaled') paid = u.wholesaleDay! + rng.int(1, 7);
    else if (u.status === 'Sold' && !u.deal) paid = u.saleDay! + rng.int(1, 10);
    if (paid !== null && paid > AS_OF) paid = null;
    const amount = u.condition === 'New' ? u.invoice_cost : Math.round((u.invoice_cost * 0.9) / 100) * 100;
    const fp: Floorplan = {
      floorplan_id: 0,
      unit: u,
      lender,
      funded,
      funded_amount: round2(amount),
      interest_rate: rate,
      paid_off: paid,
    };
    floorplans.push(fp);
  }
  floorplans.sort((a, b) => a.funded - b.funded || a.unit.key - b.unit.key);
  floorplans.forEach((f, i) => (f.floorplan_id = 50001 + i));

  // Loans paid off before the window are uninteresting; keep only loans alive during it.
  const alive = floorplans.filter((f) => f.paid_off === null || f.paid_off >= START);
  for (const f of alive) {
    const end = f.paid_off ?? AS_OF + 90;
    for (let k = 0; ; k++) {
      const due = f.funded + 180 + 90 * k;
      if (due > end) break;
      const pct = k === 0 ? 10 : 5;
      const c: Curtailment = {
        curtailment_id: 0,
        floorplan_id: f.floorplan_id,
        due,
        pct,
        amount_due: round2((f.funded_amount * pct) / 100),
        amount_paid: 0,
        paid: null,
      };
      if (due <= AS_OF) {
        const r = rng.next();
        let paid: Day | null;
        if (r < 0.8) paid = due - rng.int(0, 6);
        else if (r < 0.92) paid = due + rng.int(3, 45);
        else paid = null;
        if (paid !== null && f.paid_off !== null && paid > f.paid_off) paid = f.paid_off;
        if (paid === null && f.paid_off !== null) paid = f.paid_off;
        if (paid !== null && paid > AS_OF) paid = null;
        if (paid !== null) {
          c.paid = paid;
          c.amount_paid = c.amount_due;
        }
      }
      curtailments.push(c);
    }
  }
  curtailments.sort((a, b) => a.due - b.due || a.floorplan_id - b.floorplan_id);
  curtailments.forEach((c, i) => (c.curtailment_id = 700001 + i));
  return { floorplans: alive, curtailments };
}
