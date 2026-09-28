// The Dealer Codex: glossary cards unlocked as you play.

export type CodexCategory = 'Inventory' | 'Floorplan' | 'Sales' | 'F&I' | 'Service' | 'Systems & Data' | 'People' | 'SQL';

export interface CodexTerm {
  id: string;
  term: string;
  category: CodexCategory;
  definition: string;
  why: string;
  example?: string;
}

export const CODEX: CodexTerm[] = [
  // ---- Inventory
  {
    id: 'stock-number',
    term: 'Stock number',
    category: 'Inventory',
    definition: "The dealer's own ID for a unit, assigned when it enters inventory. Here: N/U (new/used) + year + sequence, e.g. N26-00084.",
    why: 'Everyone inside the dealership (sales, porters, accounting, service) refers to units by stock number. Deals, floorplan loans and work orders all point to it.',
    example: "SELECT * FROM units WHERE stock_no = 'N26-00084';",
  },
  {
    id: 'vin',
    term: 'VIN',
    category: 'Inventory',
    definition: "Vehicle Identification Number: the 17-character ID stamped by the manufacturer. Towables have VINs too. The 10th character encodes the model year, and the last 6 are the serial number.",
    why: 'Customers, lenders and the DMV know the VIN, not your stock number. Title, registration and warranty claims all run on it.',
    example: "SELECT stock_no FROM units WHERE vin LIKE '%471800';",
  },
  {
    id: 'rv-classes',
    term: 'RV classes',
    category: 'Inventory',
    definition: 'Motorized: Class A (bus-style motorhome), Class B (camper van) and Class C (cab-chassis with an over-cab bunk). Towable: Travel Trailer (bumper pull), Fifth Wheel (hitches in a pickup bed) and Toy Hauler (a trailer with a rear ramp garage).',
    why: 'Class drives price, margin, buyer profile, service needs and how long a unit takes to sell.',
    example: 'SELECT rv_class, COUNT(*) FROM units GROUP BY rv_class;',
  },
  {
    id: 'msrp-invoice',
    term: 'MSRP vs invoice',
    category: 'Inventory',
    definition: "MSRP is the manufacturer's suggested retail price: the sticker. Invoice is what the dealer actually paid the manufacturer. RV discounts off MSRP are often large.",
    why: 'MSRP − invoice is the potential margin, but deals close well below MSRP. Real profit is front-end gross.',
    example: 'SELECT stock_no, msrp - invoice_cost AS markup FROM units;',
  },
  {
    id: 'aging',
    term: 'Aging / days in stock',
    category: 'Inventory',
    definition: 'How long a unit has been in inventory, usually counted from the received date. Reported in buckets such as 0–90, 91–180, 181–270 and 270+ days.',
    why: 'Old units cost flooring interest, trigger curtailments and usually sell at lower gross. Aging is the #1 inventory health metric.',
    example: "SELECT stock_no, as_of_date() - received_date AS days_in_stock FROM units WHERE status = 'In Stock';",
  },
  {
    id: 'recon',
    term: 'Recon (reconditioning)',
    category: 'Inventory',
    definition: 'Repairs and detailing that make a used unit ready to sell (the "frontline-ready" standard). Recon is done on Internal work orders and its cost is added to the unit\'s cost.',
    why: 'Recon raises the unit cost, so it cuts front-end gross. If recon never gets posted to the unit, gross looks better than it really is.',
    example: "SELECT stock_no, recon_cost FROM units WHERE condition = 'Used';",
  },
  {
    id: 'pdi',
    term: 'PDI',
    category: 'Service',
    definition: 'Pre-Delivery Inspection: the service department checks every system on a new unit (LP, electrical, plumbing, slides) before it is sold or delivered. Billed Internal.',
    why: 'A good PDI prevents comebacks and warranty headaches. Its cost belongs to the unit.',
    example: "SELECT * FROM wo_jobs WHERE job_code LIKE 'PDI%';",
  },
  {
    id: 'wholesale',
    term: 'Wholesale',
    category: 'Inventory',
    definition: 'Selling a unit to another dealer or at auction instead of to a retail customer. Usually aged or rough used units.',
    why: "Wholesales are not retail sales. They're excluded from retail unit counts and PVR, and they're often sold at a loss to free up cash.",
    example: "SELECT COUNT(*) FROM units WHERE status = 'Wholesaled';",
  },

  // ---- Floorplan
  {
    id: 'floorplan',
    term: 'Floorplan',
    category: 'Floorplan',
    definition: "A revolving line of credit that finances the dealer's inventory. The lender pays the manufacturer for each unit, and the dealer pays interest monthly and repays the principal when the unit sells.",
    why: "Almost every new unit on the lot is borrowed money. Paying the loan off promptly after a sale is mandatory. Not doing so is called 'selling out of trust.'",
    example: 'SELECT * FROM floorplan_loans WHERE paid_off_date IS NULL;',
  },
  {
    id: 'curtailment',
    term: 'Curtailment',
    category: 'Floorplan',
    definition: "A required principal paydown on a floored unit that hasn't sold after a set time. Schedules vary by lender. Ours: 10% of the original principal at 180 days, then 5% every 90 days after.",
    why: 'Curtailments turn slow inventory into immediate cash outflows. Controllers watch upcoming and late curtailments closely.',
    example: 'SELECT * FROM curtailments WHERE paid_date IS NULL AND due_date < as_of_date();',
  },
  {
    id: 'flooring-interest',
    term: 'Flooring interest',
    category: 'Floorplan',
    definition: 'The interest cost of carrying a unit on floorplan: roughly principal × annual rate ÷ 365 × days outstanding. It starts on the funded date, which can be before the unit arrives.',
    why: 'Every extra day on the lot costs money. Flooring interest is a big part of the true cost of aged inventory.',
    example: 'SELECT stock_no, funded_amount * interest_rate / 100 / 365 * (as_of_date() - funded_date) AS interest_to_date FROM floorplan_loans;',
  },

  // ---- Sales
  {
    id: 'front-gross',
    term: 'Front-end gross',
    category: 'Sales',
    definition: 'Profit on the unit itself: sale price − unit cost (invoice + recon/add-ons) − any over-allowance on the trade.',
    why: "Front gross pays the salesperson's commission and is the core of sales department profit.",
    example: 'SELECT AVG(front_gross) FROM deals WHERE deal_status = \'Funded\';',
  },
  {
    id: 'trade-in',
    term: 'Trade-in',
    category: 'Sales',
    definition: "The customer's current RV, applied toward the purchase. It becomes used inventory at its ACV.",
    why: 'Trades feed the used lot. How they are valued changes both deal gross and future used gross.',
    example: 'SELECT * FROM deals WHERE trade_in_stock_no IS NOT NULL;',
  },
  {
    id: 'acv',
    term: 'ACV',
    category: 'Sales',
    definition: 'Actual Cash Value: what the dealer appraises a trade to be really worth (roughly its wholesale value). It becomes the used unit\'s cost.',
    why: 'Appraising too high overpays for inventory. ACV is the honest number; the allowance is the negotiated one.',
    example: 'SELECT AVG(trade_acv) FROM deals WHERE trade_acv IS NOT NULL;',
  },
  {
    id: 'over-allowance',
    term: 'Over-allowance',
    category: 'Sales',
    definition: "Giving the customer more for their trade than it's worth: trade_allowance − trade_acv. A negative number is an under-allowance.",
    why: 'Over-allowance is a hidden discount. It comes straight out of front-end gross, so managers track it by salesperson.',
    example: 'SELECT deal_id, trade_allowance - trade_acv AS over_allowance FROM deals;',
  },
  {
    id: 'funded',
    term: 'Funded deal',
    category: 'Sales',
    definition: "A deal where the lender has paid the dealer for the retail installment contract (or the cash has cleared). Until then it's Pending, a 'contract in transit.'",
    why: 'Cash flow and many unit counts are based on funded deals. Pending contracts are money you do not have yet.',
    example: "SELECT COUNT(*) FROM deals WHERE deal_status = 'Funded';",
  },
  {
    id: 'unwind',
    term: 'Unwind',
    category: 'Sales',
    definition: 'A deal that is reversed after signing (financing falls through, buyer backs out). The unit returns to inventory.',
    why: 'Unwinds should not count as sales. Forgetting to exclude them inflates units sold and gross.',
    example: "SELECT * FROM deals WHERE deal_status = 'Unwound';",
  },
  {
    id: 'lead-source',
    term: 'Lead source',
    category: 'Sales',
    definition: 'Where a sales opportunity came from: website, walk-in, phone, RV show, third-party marketplace or referral.',
    why: 'Marketing dollars follow lead sources. You need volume AND close rate by source to judge them.',
    example: 'SELECT source, COUNT(*) FROM leads GROUP BY source;',
  },
  {
    id: 'close-rate',
    term: 'Close rate',
    category: 'Sales',
    definition: 'The share of leads that became sales: sold leads ÷ total leads. Always check the denominator: which leads, which period, and are there duplicates?',
    why: 'The key efficiency metric for a sales team and each lead source. Duplicate leads quietly drag it down.',
    example: "SELECT source, AVG(CASE WHEN status = 'Sold' THEN 1.0 ELSE 0 END) FROM leads GROUP BY source;",
  },

  // ---- F&I
  {
    id: 'fi',
    term: 'F&I',
    category: 'F&I',
    definition: "Finance & Insurance: the office (often called 'the box') that arranges the customer's loan and offers protection products like service contracts and GAP, with heavy compliance requirements.",
    why: 'F&I produces back-end gross, often a large share of the profit per unit.',
  },
  {
    id: 'back-gross',
    term: 'Back-end gross',
    category: 'F&I',
    definition: 'Profit made in F&I: product profit (sale price − cost of service contracts, GAP, etc.) plus finance reserve (the dealer\'s share of the loan rate). Our data tracks product profit.',
    why: 'Front + back = total deal gross. A store can have good front gross and still be weak overall if F&I is weak.',
    example: 'SELECT deal_id, SUM(sale_price - cost) AS back_gross FROM fi_products GROUP BY deal_id;',
  },
  {
    id: 'pvr',
    term: 'PVR (per vehicle retailed)',
    category: 'F&I',
    definition: 'Gross ÷ number of retail units sold. F&I PVR uses back-end gross; total PVR uses front + back. Exclude wholesales and unwinds from the denominator.',
    why: "PVR lets you compare stores of different sizes. It's the standard way F&I managers are measured.",
    example: 'SELECT SUM(back_gross) / COUNT(*) AS fi_pvr FROM …;',
  },
  {
    id: 'penetration',
    term: 'Penetration rate',
    category: 'F&I',
    definition: 'The share of retail deals that included a product: deals with a service contract ÷ retail deals. Some products (like GAP) are measured against financed deals only.',
    why: 'Penetration shows whether every customer is being offered every product, a compliance AND profit issue.',
  },

  // ---- Service
  {
    id: 'work-order',
    term: 'Work order / RO',
    category: 'Service',
    definition: 'A repair order: the document that opens when an RV comes into service, lists the jobs (labor + parts) and becomes the invoice when closed.',
    why: 'Everything in fixed operations (service + parts) is measured from ROs.',
    example: 'SELECT * FROM work_orders LIMIT 10;',
  },
  {
    id: 'bill-types',
    term: 'Bill types (CP / Warranty / Internal)',
    category: 'Service',
    definition: "Who pays for the work: Customer Pay (the customer), Warranty (the manufacturer reimburses at its own rates) or Internal (the dealer pays itself, e.g. PDI and recon on inventory).",
    why: 'Each bill type has different labor rates and margins. Mixing them hides how profitable service really is.',
    example: 'SELECT bill_type, COUNT(*) FROM work_orders GROUP BY bill_type;',
  },
  {
    id: 'flag-hours',
    term: 'Flat-rate / flag hours',
    category: 'Service',
    definition: 'Labor is billed from a labor time guide, not the clock. A job "flags" e.g. 2.0 hours whether the tech takes 1.5 or 3.',
    why: 'Techs are often paid per flag hour, so speed matters to them. Flag hours × rate = labor sales.',
  },
  {
    id: 'tech-efficiency',
    term: 'Tech efficiency',
    category: 'Service',
    definition: 'Flag hours ÷ actual (clock) hours on the jobs. Above 100% means the tech beats the labor guide.',
    why: "It's the core measure of technician performance, and it drives shop capacity and pay.",
    example: 'SELECT technician_id, SUM(flag_hours) / SUM(actual_hours) FROM wo_jobs GROUP BY 1;',
  },
  {
    id: 'elr',
    term: 'Effective labor rate',
    category: 'Service',
    definition: 'Labor sales ÷ hours billed. Lower than the posted "door rate" because warranty and internal work pay less (and discounts happen).',
    why: 'ELR shows what the shop really earns per hour. It matters for pricing and for warranty-rate negotiations.',
  },
  {
    id: 'parts-gross',
    term: 'Parts gross',
    category: 'Service',
    definition: 'Parts sale − parts cost on repair orders (and counter sales).',
    why: 'Parts is a high-margin department. Gross by bill type shows where the money is.',
  },

  // ---- Systems & data
  {
    id: 'dms',
    term: 'DMS',
    category: 'Systems & Data',
    definition: "Dealer Management System: the dealership's core system of record for inventory, deals, service and accounting.",
    why: "Most of your tables come from the DMS. Its quirks (like work-order numbers that repeat by store) shape how you query.",
  },
  {
    id: 'crm',
    term: 'CRM',
    category: 'Systems & Data',
    definition: 'Customer Relationship Management system: tracks leads, customers and follow-ups. Separate from the DMS, so IDs and data quality often differ.',
    why: 'Lead and close-rate analysis lives here, and so do duplicate records after migrations.',
  },
  {
    id: 'surrogate-key',
    term: 'Surrogate vs business key',
    category: 'Systems & Data',
    definition: 'A surrogate key (lead_id) is a meaningless ID assigned by the database. A business key (lead_number) is the ID people use. After a migration they can disagree: one lead_number, two lead_ids.',
    why: 'Counting by the surrogate key can double-count real-world things. Always ask what uniquely identifies the business entity.',
    example: 'SELECT lead_number, COUNT(*) FROM leads GROUP BY 1 HAVING COUNT(*) > 1;',
  },
  {
    id: 'composite-key',
    term: 'Composite key',
    category: 'Systems & Data',
    definition: 'A key made of more than one column. Work orders are unique by (wo_number, location_id) because each store numbers its own ROs.',
    why: 'Joining on only part of a composite key silently multiplies rows (fan-out).',
    example: 'SELECT * FROM work_orders w JOIN wo_jobs j ON j.wo_number = w.wo_number AND j.location_id = w.location_id;',
  },
  {
    id: 'sentinel',
    term: 'Sentinel values (-1)',
    category: 'Systems & Data',
    definition: 'A fake value like -1 used to mean "unknown" instead of NULL. Common in legacy systems and warehouses.',
    why: "Sentinels don't join to anything, don't count as NULL, and can drag averages. Convert them with NULLIF(col, -1).",
    example: 'SELECT COUNT(*) FROM deals WHERE salesperson_id = -1;',
  },
  {
    id: 'fan-out',
    term: 'Fan-out',
    category: 'SQL',
    definition: 'When a join matches one row to many, rows multiply, and any SUM or COUNT afterwards double-counts.',
    why: 'The #1 cause of "these numbers are too big" in dealership reporting (e.g. deals joined to F&I products).',
  },
  {
    id: 'null',
    term: 'NULL',
    category: 'SQL',
    definition: 'A missing or unknown value. Comparisons with NULL are never true, so use IS NULL. Aggregates like SUM/AVG/COUNT(col) skip NULLs.',
    why: 'Most "missing rows" bugs are NULL bugs.',
    example: 'SELECT * FROM units WHERE received_date IS NULL;',
  },

  // ---- People
  {
    id: 'headcount',
    term: 'Headcount',
    category: 'People',
    definition: 'Number of employees active on a date: hired on or before it and not terminated before it.',
    why: 'The denominator for turnover and staffing ratios.',
  },
  {
    id: 'turnover',
    term: 'Turnover rate',
    category: 'People',
    definition: 'Terminations in a period ÷ average headcount in that period. Often split into voluntary and involuntary.',
    why: 'Dealership sales turnover is famously high, and every departure costs recruiting and training time.',
  },
  {
    id: 'tenure',
    term: 'Tenure',
    category: 'People',
    definition: 'How long someone has worked here: from hire date to termination date (or today, if still employed).',
    why: 'Tenure predicts productivity and retention risk.',
  },
];

export const CODEX_BY_ID: Record<string, CodexTerm> = Object.fromEntries(CODEX.map((t) => [t.id, t]));
