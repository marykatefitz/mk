// Single source of truth for the Summit Trail RV database.
// Drives: DDL, the JSON loader, the schema explorer / ERD, editor autocomplete,
// and the "what does this column mean in dealer terms" dictionary.

export type SqlType = 'INTEGER' | 'VARCHAR' | 'DATE' | 'TIMESTAMP' | 'DOUBLE';

export interface ColumnDef {
  name: string;
  type: SqlType;
  description: string;
  pk?: boolean;
  fk?: { table: string; column: string };
  nullable?: boolean;
}

export type SourceSystem = 'DMS' | 'CRM' | 'Floorplan portal' | 'HRIS' | 'Service (DMS)';

export interface TableDef {
  name: string;
  system: SourceSystem;
  description: string;
  columns: ColumnDef[];
}

const c = (
  name: string,
  type: SqlType,
  description: string,
  extra: Partial<ColumnDef> = {},
): ColumnDef => ({ name, type, description, ...extra });

export const TABLES: TableDef[] = [
  {
    name: 'locations',
    system: 'DMS',
    description: 'The 12 Summit Trail RV stores (rooftops).',
    columns: [
      c('location_id', 'INTEGER', 'Store ID.', { pk: true }),
      c('location_name', 'VARCHAR', 'Store name, usually the city it sits in.'),
      c('region', 'VARCHAR', 'Operating region: Mountain, Southwest, Midwest or Southeast.'),
      c('state', 'VARCHAR', 'Two-letter state code.'),
      c('opened_date', 'DATE', 'When the store opened (or was acquired by the group).'),
    ],
  },
  {
    name: 'units',
    system: 'DMS',
    description:
      'Inventory: every RV the group has owned, whether bought from a manufacturer, at auction, or taken in on trade.',
    columns: [
      c('stock_no', 'VARCHAR', 'Stock number: the dealer-assigned ID for a unit. N = new, U = used, then 2-digit year and a sequence.', { pk: true }),
      c('vin', 'VARCHAR', 'Vehicle Identification Number: the 17-character manufacturer ID. The 10th character encodes the model year.'),
      c('model_year', 'INTEGER', 'Model year (often one ahead of the calendar year for new units).'),
      c('manufacturer', 'VARCHAR', 'Who built it (all fictional brands).'),
      c('model', 'VARCHAR', 'Brand series plus floorplan code, e.g. "Pinecrest Ridge 28BH" (BH = bunkhouse).'),
      c('rv_class', 'VARCHAR', "'Class A','Class B','Class C' (motorized) or 'Travel Trailer','Fifth Wheel','Toy Hauler' (towables)."),
      c('condition', 'VARCHAR', "'New' or 'Used'."),
      c('location_id', 'INTEGER', 'Store currently holding the unit.', { fk: { table: 'locations', column: 'location_id' } }),
      c('received_date', 'DATE', 'Day the unit physically arrived on the lot. NULL while In Transit (and, sadly, for a few bad records).', { nullable: true }),
      c('msrp', 'DOUBLE', "Manufacturer's Suggested Retail Price for new units; the asking price for used units."),
      c('invoice_cost', 'DOUBLE', 'What the dealer paid: the factory invoice for new units, or ACV for trades and auction buys.'),
      c('recon_cost', 'DOUBLE', 'Reconditioning and PDI cost charged to the unit. Should match internal work orders, but does not always.', { nullable: true }),
      c('status', 'VARCHAR', "'In Stock','Sold','In Recon','In Transit' or 'Wholesaled'."),
    ],
  },
  {
    name: 'floorplan_loans',
    system: 'Floorplan portal',
    description:
      'Floorplan: the revolving inventory loans the dealer uses to pay manufacturers. Each floored unit has one loan, paid off when the unit sells.',
    columns: [
      c('floorplan_id', 'INTEGER', 'Loan ID from the lender portal.', { pk: true }),
      c('stock_no', 'VARCHAR', 'The unit that secures this loan.', { fk: { table: 'units', column: 'stock_no' } }),
      c('lender', 'VARCHAR', 'Floorplan lender (fictional).'),
      c('funded_date', 'DATE', 'Day the lender paid the manufacturer. Interest starts accruing here, often before the unit arrives.'),
      c('funded_amount', 'DOUBLE', 'Principal borrowed, usually 100% of invoice for new units.'),
      c('interest_rate', 'DOUBLE', 'Annual interest rate as a percent (7.75 means 7.75%).'),
      c('paid_off_date', 'DATE', 'Day the loan was paid off (after the sale funds). NULL means still outstanding.', { nullable: true }),
    ],
  },
  {
    name: 'curtailments',
    system: 'Floorplan portal',
    description:
      'Curtailments: scheduled principal paydowns the lender requires on aging units, typically 10% at 180 days and then 5% every 90 days.',
    columns: [
      c('curtailment_id', 'INTEGER', 'Curtailment ID.', { pk: true }),
      c('floorplan_id', 'INTEGER', 'Loan this curtailment belongs to.', { fk: { table: 'floorplan_loans', column: 'floorplan_id' } }),
      c('due_date', 'DATE', 'When the paydown is due.'),
      c('curtailment_pct', 'DOUBLE', 'Percent of original principal due (10 = 10%).'),
      c('amount_due', 'DOUBLE', 'Dollar amount due.'),
      c('amount_paid', 'DOUBLE', 'Dollars paid so far (0 when unpaid).'),
      c('paid_date', 'DATE', 'When it was paid. NULL = not paid yet.', { nullable: true }),
    ],
  },
  {
    name: 'customers',
    system: 'CRM',
    description: 'People who have inquired, bought, or had service done. All names are fictional.',
    columns: [
      c('customer_id', 'INTEGER', 'Customer ID.', { pk: true }),
      c('first_name', 'VARCHAR', 'First name.'),
      c('last_name', 'VARCHAR', 'Last name.'),
      c('city', 'VARCHAR', 'City.'),
      c('state', 'VARCHAR', 'Two-letter state code.'),
      c('created_date', 'DATE', 'When the customer record was created.'),
    ],
  },
  {
    name: 'leads',
    system: 'CRM',
    description:
      'Sales leads. lead_id is the surrogate key; lead_number is the business ID. Watch out: the March 2025 CRM migration duplicated some lead_numbers.',
    columns: [
      c('lead_id', 'INTEGER', 'Surrogate key: a meaningless row ID assigned by the database.', { pk: true }),
      c('lead_number', 'VARCHAR', 'Business key: the lead number salespeople see. Should be unique, but is not always.'),
      c('customer_id', 'INTEGER', 'Who the lead is.', { fk: { table: 'customers', column: 'customer_id' } }),
      c('location_id', 'INTEGER', 'Store the lead was routed to.', { fk: { table: 'locations', column: 'location_id' } }),
      c('source', 'VARCHAR', "'Website','Walk-in','Phone','RV Show','Third-party marketplace' or 'Referral'."),
      c('created_date', 'DATE', 'When the lead came in.'),
      c('rv_class_interest', 'VARCHAR', 'What kind of RV they asked about.'),
      c('status', 'VARCHAR', "Funnel stage: 'New','Working','Appointment Set','Sold' or 'Lost'."),
      c('assigned_employee_id', 'INTEGER', 'Salesperson working the lead. -1 means "unknown" (a sentinel value, not a real employee).', { fk: { table: 'employees', column: 'employee_id' } }),
      c('updated_at', 'TIMESTAMP', 'Last time the lead record changed.'),
    ],
  },
  {
    name: 'deals',
    system: 'DMS',
    description: 'Retail sales deals (one per unit sold to a retail customer).',
    columns: [
      c('deal_id', 'INTEGER', 'Deal number.', { pk: true }),
      c('stock_no', 'VARCHAR', 'Unit sold.', { fk: { table: 'units', column: 'stock_no' } }),
      c('customer_id', 'INTEGER', 'Buyer.', { fk: { table: 'customers', column: 'customer_id' } }),
      c('lead_id', 'INTEGER', 'CRM lead that turned into this deal. NULL when no lead was logged.', { fk: { table: 'leads', column: 'lead_id' }, nullable: true }),
      c('location_id', 'INTEGER', 'Selling store.', { fk: { table: 'locations', column: 'location_id' } }),
      c('salesperson_id', 'INTEGER', 'Salesperson. -1 = unknown (sentinel).', { fk: { table: 'employees', column: 'employee_id' } }),
      c('deal_date', 'DATE', 'Contract date.'),
      c('sale_price', 'DOUBLE', 'Selling price of the unit (before trade, taxes and fees).'),
      c('trade_in_stock_no', 'VARCHAR', 'Stock number given to the trade-in, if there was one.', { fk: { table: 'units', column: 'stock_no' }, nullable: true }),
      c('trade_allowance', 'DOUBLE', 'What the customer was told their trade is worth (credited on the deal).', { nullable: true }),
      c('trade_acv', 'DOUBLE', 'Actual Cash Value: what the trade is really worth to the dealer (the wholesale value).', { nullable: true }),
      c('down_payment', 'DOUBLE', 'Cash down.'),
      c('finance_type', 'VARCHAR', "'Cash','Retail Finance' (arranged by F&I) or 'Outside Finance' (the customer's own bank)."),
      c('lender', 'VARCHAR', 'Retail lender. NULL for cash deals.', { nullable: true }),
      c('apr', 'DOUBLE', 'Annual percentage rate as a percent. NULL for cash.', { nullable: true }),
      c('term_months', 'INTEGER', 'Loan term in months (RV loans are long: 120 to 240). NULL for cash.', { nullable: true }),
      c('amount_financed', 'DOUBLE', 'Amount financed. NULL for cash.', { nullable: true }),
      c('front_gross', 'DOUBLE', 'Front-end gross: sale price − (invoice + recon) − over-allowance on the trade.'),
      c('deal_status', 'VARCHAR', "'Funded' (the lender paid us), 'Pending' (contract signed, not yet funded) or 'Unwound' (deal reversed)."),
    ],
  },
  {
    name: 'fi_products',
    system: 'DMS',
    description: 'F&I (Finance & Insurance) products sold on each deal. These make up the back-end gross.',
    columns: [
      c('deal_id', 'INTEGER', 'Deal the product was sold on.', { pk: true, fk: { table: 'deals', column: 'deal_id' } }),
      c('product', 'VARCHAR', "'Extended Service Contract','GAP','Tire & Wheel','Roadside' or 'Appearance Protection'.", { pk: true }),
      c('sale_price', 'DOUBLE', 'Price charged to the customer.'),
      c('cost', 'DOUBLE', 'Dealer cost from the product provider. sale_price − cost is back-end gross.'),
    ],
  },
  {
    name: 'employees',
    system: 'HRIS',
    description: 'Everyone who has worked at Summit Trail RV, current and former. manager_id points back to this table.',
    columns: [
      c('employee_id', 'INTEGER', 'Employee ID.', { pk: true }),
      c('first_name', 'VARCHAR', 'First name.'),
      c('last_name', 'VARCHAR', 'Last name.'),
      c('role', 'VARCHAR', 'Job role.'),
      c('department', 'VARCHAR', 'Sales, F&I, Service, Parts, Lot, Admin or Corporate.'),
      c('location_id', 'INTEGER', 'Home store. NULL for corporate staff.', { fk: { table: 'locations', column: 'location_id' }, nullable: true }),
      c('manager_id', 'INTEGER', "Direct manager's employee_id (a self-join). NULL at the top.", { fk: { table: 'employees', column: 'employee_id' }, nullable: true }),
      c('hire_date', 'DATE', 'Hire date.'),
      c('termination_date', 'DATE', 'Last day. NULL = still employed.', { nullable: true }),
      c('termination_reason', 'VARCHAR', 'Why they left. NULL if still employed.', { nullable: true }),
      c('employment_type', 'VARCHAR', "'Full-time','Part-time' or 'Seasonal'."),
    ],
  },
  {
    name: 'pay_history',
    system: 'HRIS',
    description: 'Pay rate changes (all numbers fictional). The current rate is the latest effective_date.',
    columns: [
      c('employee_id', 'INTEGER', 'Employee.', { pk: true, fk: { table: 'employees', column: 'employee_id' } }),
      c('effective_date', 'DATE', 'When this rate took effect.', { pk: true }),
      c('pay_type', 'VARCHAR', "'Hourly' ($/hr), 'Salary' ($/yr) or 'Commission+Draw' (monthly draw against commission)."),
      c('rate', 'DOUBLE', 'Rate in the pay_type units.'),
    ],
  },
  {
    name: 'time_off',
    system: 'HRIS',
    description: 'Time-off requests.',
    columns: [
      c('time_off_id', 'INTEGER', 'Request ID.', { pk: true }),
      c('employee_id', 'INTEGER', 'Employee.', { fk: { table: 'employees', column: 'employee_id' } }),
      c('start_date', 'DATE', 'First day off.'),
      c('end_date', 'DATE', 'Last day off.'),
      c('time_off_type', 'VARCHAR', "'PTO','Sick','Unpaid','Bereavement' or 'Jury Duty'."),
      c('hours', 'DOUBLE', 'Hours requested.'),
      c('status', 'VARCHAR', "'Approved','Denied' or 'Pending'."),
    ],
  },
  {
    name: 'training_completions',
    system: 'HRIS',
    description: 'Completed training courses (compliance and skills).',
    columns: [
      c('employee_id', 'INTEGER', 'Employee.', { pk: true, fk: { table: 'employees', column: 'employee_id' } }),
      c('course', 'VARCHAR', 'Course name.', { pk: true }),
      c('completed_date', 'DATE', 'Completion date.', { pk: true }),
      c('score', 'INTEGER', 'Quiz score (0 to 100).'),
    ],
  },
  {
    name: 'work_orders',
    system: 'Service (DMS)',
    description:
      'Service work order (a.k.a. repair order, RO) headers. WO numbers restart at every store, so the key is (wo_number, location_id).',
    columns: [
      c('wo_number', 'INTEGER', 'Work order number. Only unique within a store.', { pk: true }),
      c('location_id', 'INTEGER', 'Store. Part of the composite key.', { pk: true, fk: { table: 'locations', column: 'location_id' } }),
      c('customer_id', 'INTEGER', 'Customer. NULL for Internal work on dealer inventory.', { fk: { table: 'customers', column: 'customer_id' }, nullable: true }),
      c('stock_no', 'VARCHAR', "Unit worked on, when it's one we sold or own. NULL for outside customers' RVs.", { fk: { table: 'units', column: 'stock_no' }, nullable: true }),
      c('bill_type', 'VARCHAR', "'Customer Pay' (the customer pays), 'Warranty' (the manufacturer pays) or 'Internal' (the dealer pays: PDI and recon)."),
      c('opened_date', 'DATE', 'When the RV was written up.'),
      c('closed_date', 'DATE', 'When the WO was closed and invoiced. NULL if still open (or bad data).', { nullable: true }),
      c('status', 'VARCHAR', "'Open','Waiting on Parts' or 'Closed'."),
      c('advisor_id', 'INTEGER', 'Service advisor who wrote it up. -1 = unknown.', { fk: { table: 'employees', column: 'employee_id' } }),
    ],
  },
  {
    name: 'wo_jobs',
    system: 'Service (DMS)',
    description: 'Job lines on a work order. Join to work_orders on BOTH wo_number and location_id.',
    columns: [
      c('job_id', 'INTEGER', 'Job line ID.', { pk: true }),
      c('wo_number', 'INTEGER', 'Work order number (part 1 of the composite key).', { fk: { table: 'work_orders', column: 'wo_number' } }),
      c('location_id', 'INTEGER', 'Store (part 2 of the composite key).', { fk: { table: 'work_orders', column: 'location_id' } }),
      c('job_code', 'VARCHAR', 'Operation code, e.g. PDI, CP-AC, WAR-SLIDE.'),
      c('description', 'VARCHAR', 'What the job was.'),
      c('flag_hours', 'DOUBLE', 'Flat-rate hours billed (from the labor guide), regardless of how long it really took.'),
      c('actual_hours', 'DOUBLE', 'Clock hours the tech actually spent.'),
      c('labor_rate', 'DOUBLE', 'Dollars per flag hour charged for this job (varies by bill type).'),
      c('parts_cost', 'DOUBLE', 'Dealer cost of parts used.'),
      c('parts_sale', 'DOUBLE', 'What the parts were sold for.'),
      c('technician_id', 'INTEGER', 'Tech who did the job.', { fk: { table: 'employees', column: 'employee_id' } }),
    ],
  },
];

export const TABLE_BY_NAME: Record<string, TableDef> = Object.fromEntries(TABLES.map((t) => [t.name, t]));

export const AS_OF_DATE = '2026-06-30';
export const DATA_START_DATE = '2024-07-01';

export function ddlFor(t: TableDef): string {
  const cols = t.columns.map((col) => `  ${col.name} ${col.type}`);
  const pk = t.columns.filter((col) => col.pk).map((col) => col.name);
  if (pk.length) cols.push(`  PRIMARY KEY (${pk.join(', ')})`);
  return `CREATE TABLE ${t.name} (\n${cols.join(',\n')}\n);`;
}

export function fullDdl(): string {
  return TABLES.map(ddlFor).join('\n\n');
}
