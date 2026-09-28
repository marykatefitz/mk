import type { Day } from './dates';
import type { LeadSource, RvClass } from './reference';

export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Employee {
  key: number; // internal, pre-ID
  employee_id: number;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  location_id: number | null;
  managerRole: string | null; // role of manager slot (resolved later)
  manager_id: number | null;
  hire: Day;
  term: Day | null;
  termination_reason: string | null;
  employment_type: 'Full-time' | 'Part-time' | 'Seasonal';
  /** technician speed factor (flag hours per clock hour) */
  efficiency: number;
}

export interface Unit {
  key: number;
  stock_no: string;
  vin: string;
  model_year: number;
  manufacturer: string;
  model: string;
  rv_class: RvClass;
  condition: 'New' | 'Used';
  location_id: number;
  /** physical arrival; null while in transit */
  received: Day | null;
  /** date used for stock-number sequencing and floorplan funding */
  acquired: Day;
  msrp: number;
  invoice_cost: number;
  recon_cost: number | null;
  status: 'In Stock' | 'Sold' | 'In Recon' | 'In Transit' | 'Wholesaled';
  origin: 'factory' | 'auction' | 'trade';
  saleDay: Day | null;
  wholesaleDay: Day | null;
  deal: Deal | null;
}

export interface Deal {
  key: number;
  deal_id: number;
  unit: Unit;
  customer: Customer | null;
  lead_id: number | null;
  location_id: number;
  salesperson_id: number;
  day: Day;
  sale_price: number;
  trade: Unit | null;
  trade_allowance: number | null;
  trade_acv: number | null;
  down_payment: number;
  finance_type: 'Cash' | 'Retail Finance' | 'Outside Finance';
  lender: string | null;
  apr: number | null;
  term_months: number | null;
  amount_financed: number | null;
  front_gross: number;
  deal_status: 'Funded' | 'Pending' | 'Unwound';
  products: { product: string; sale_price: number; cost: number }[];
  leadSource: LeadSource | null;
}

export interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  created: Day;
  storeId: number;
}

export interface Lead {
  lead_id: number;
  lead_number: string;
  customer: Customer;
  deal: Deal | null;
  location_id: number;
  source: LeadSource;
  created: Day;
  rv_class_interest: RvClass;
  status: 'New' | 'Working' | 'Appointment Set' | 'Sold' | 'Lost';
  assigned_employee_id: number;
  updated_at: string;
  isMigrationCopy: boolean;
}

export interface WorkOrder {
  wo_number: number;
  location_id: number;
  customer: Customer | null;
  unit: Unit | null;
  bill_type: 'Customer Pay' | 'Warranty' | 'Internal';
  opened: Day;
  closed: Day | null;
  status: 'Open' | 'Waiting on Parts' | 'Closed';
  advisor_id: number;
  jobs: Job[];
}

export interface Job {
  job_id: number;
  job_code: string;
  description: string;
  flag_hours: number;
  actual_hours: number;
  labor_rate: number;
  parts_cost: number;
  parts_sale: number;
  technician_id: number;
}

export interface Dataset {
  seed: number;
  tables: Record<string, Row[]>;
}
