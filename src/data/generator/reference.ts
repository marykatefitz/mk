// Static reference data for the generator. Every brand, lender and person
// here is fictional.

export interface StoreProfile {
  id: number;
  name: string;
  region: 'Mountain' | 'Southwest' | 'Midwest' | 'Southeast';
  state: string;
  opened: string;
  /** relative volume */
  size: number;
  /** median days to sell a unit */
  medianDaysToSell: number;
  /** multiplier on F&I product penetration */
  fiStrength: number;
  /** skew of inventory toward expensive motorized units */
  luxury: number;
  doorRate: number;
  /** share of normal new-unit arrivals kept in the final ~7 months (Boise over-ordered, then froze orders) */
  recentArrivals?: number;
  floorplanLender: string;
  cities: string[];
}

export const STORES: StoreProfile[] = [
  { id: 1, name: 'Denver', region: 'Mountain', state: 'CO', opened: '1998-04-01', size: 1.35, medianDaysToSell: 95, fiStrength: 1.1, luxury: 1.2, doorRate: 179, floorplanLender: 'Ridgeline Commercial Finance', cities: ['Denver', 'Aurora', 'Lakewood', 'Littleton', 'Golden', 'Castle Rock'] },
  { id: 2, name: 'Colorado Springs', region: 'Mountain', state: 'CO', opened: '2006-03-15', size: 1.0, medianDaysToSell: 125, fiStrength: 1.0, luxury: 1.0, doorRate: 169, floorplanLender: 'Ridgeline Commercial Finance', cities: ['Colorado Springs', 'Pueblo', 'Monument', 'Fountain', 'Canon City'] },
  { id: 3, name: 'Salt Lake City', region: 'Mountain', state: 'UT', opened: '2011-05-02', size: 1.1, medianDaysToSell: 120, fiStrength: 1.05, luxury: 1.0, doorRate: 175, floorplanLender: 'Blue Mesa Floorplan', cities: ['Salt Lake City', 'Sandy', 'Ogden', 'Provo', 'West Jordan', 'Layton'] },
  { id: 4, name: 'Boise', region: 'Mountain', state: 'ID', opened: '2019-08-19', size: 0.8, medianDaysToSell: 260, recentArrivals: 0.3, fiStrength: 0.95, luxury: 0.9, doorRate: 159, floorplanLender: 'Blue Mesa Floorplan', cities: ['Boise', 'Meridian', 'Nampa', 'Eagle', 'Caldwell'] },
  { id: 5, name: 'Phoenix', region: 'Southwest', state: 'AZ', opened: '2002-10-07', size: 1.45, medianDaysToSell: 150, fiStrength: 1.0, luxury: 1.6, doorRate: 189, floorplanLender: 'Evergreen Dealer Capital', cities: ['Phoenix', 'Mesa', 'Scottsdale', 'Chandler', 'Glendale', 'Gilbert'] },
  { id: 6, name: 'Tucson', region: 'Southwest', state: 'AZ', opened: '2009-02-23', size: 0.95, medianDaysToSell: 130, fiStrength: 0.5, luxury: 1.0, doorRate: 165, floorplanLender: 'Evergreen Dealer Capital', cities: ['Tucson', 'Marana', 'Oro Valley', 'Sahuarita', 'Green Valley'] },
  { id: 7, name: 'Albuquerque', region: 'Southwest', state: 'NM', opened: '2014-06-09', size: 0.85, medianDaysToSell: 135, fiStrength: 0.95, luxury: 0.9, doorRate: 155, floorplanLender: 'Blue Mesa Floorplan', cities: ['Albuquerque', 'Rio Rancho', 'Santa Fe', 'Los Lunas'] },
  { id: 8, name: 'Des Moines', region: 'Midwest', state: 'IA', opened: '2012-03-12', size: 0.9, medianDaysToSell: 125, fiStrength: 1.1, luxury: 0.85, doorRate: 149, floorplanLender: 'Ridgeline Commercial Finance', cities: ['Des Moines', 'Ankeny', 'Ames', 'West Des Moines', 'Urbandale'] },
  { id: 9, name: 'Grand Rapids', region: 'Midwest', state: 'MI', opened: '2016-04-18', size: 1.0, medianDaysToSell: 130, fiStrength: 1.05, luxury: 0.9, doorRate: 155, floorplanLender: 'Ridgeline Commercial Finance', cities: ['Grand Rapids', 'Holland', 'Kentwood', 'Wyoming', 'Muskegon'] },
  { id: 10, name: 'Indianapolis', region: 'Midwest', state: 'IN', opened: '2008-09-02', size: 1.05, medianDaysToSell: 120, fiStrength: 1.0, luxury: 0.95, doorRate: 159, floorplanLender: 'Evergreen Dealer Capital', cities: ['Indianapolis', 'Carmel', 'Fishers', 'Noblesville', 'Greenwood'] },
  { id: 11, name: 'Knoxville', region: 'Southeast', state: 'TN', opened: '2017-01-16', size: 0.95, medianDaysToSell: 125, fiStrength: 1.15, luxury: 0.95, doorRate: 155, floorplanLender: 'Blue Mesa Floorplan', cities: ['Knoxville', 'Maryville', 'Oak Ridge', 'Sevierville', 'Farragut'] },
  { id: 12, name: 'Ocala', region: 'Southeast', state: 'FL', opened: '2022-02-07', size: 1.0, medianDaysToSell: 120, fiStrength: 1.05, luxury: 1.15, doorRate: 165, floorplanLender: 'Evergreen Dealer Capital', cities: ['Ocala', 'Gainesville', 'The Villages', 'Leesburg', 'Belleview'] },
];

export const FLOORPLAN_LENDERS = ['Ridgeline Commercial Finance', 'Blue Mesa Floorplan', 'Evergreen Dealer Capital'] as const;

export const RETAIL_LENDERS = ['Alpine Credit Union', 'Trailhead Bank', 'Northstar RV Lending', 'Canyon Federal CU'] as const;
export const OUTSIDE_LENDERS = ['Hometown Savings', 'Prairie State Bank', 'Customer Credit Union', 'Lakeside Community Bank'] as const;

export type RvClass = 'Class A' | 'Class B' | 'Class C' | 'Travel Trailer' | 'Fifth Wheel' | 'Toy Hauler';

export const RV_CLASSES: RvClass[] = ['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler'];

export const CLASS_MIX: [RvClass, number][] = [
  ['Travel Trailer', 40],
  ['Fifth Wheel', 20],
  ['Toy Hauler', 12],
  ['Class C', 12],
  ['Class A', 8],
  ['Class B', 8],
];

/** New MSRP range per class. */
export const MSRP_RANGE: Record<RvClass, [number, number]> = {
  'Travel Trailer': [28_000, 68_000],
  'Fifth Wheel': [58_000, 135_000],
  'Toy Hauler': [62_000, 145_000],
  'Class C': [98_000, 185_000],
  'Class B': [125_000, 215_000],
  'Class A': [165_000, 495_000],
};

interface Brand {
  name: string;
  series: Partial<Record<RvClass, string[]>>;
}

export const BRANDS: Brand[] = [
  { name: 'Pinecrest RV', series: { 'Travel Trailer': ['Ridge', 'Trailhead'], 'Fifth Wheel': ['Summit'], 'Toy Hauler': ['Basecamp'] } },
  { name: 'Aspen Hollow', series: { 'Travel Trailer': ['Glade', 'Willow'], 'Fifth Wheel': ['Timberline', 'Crest'] } },
  { name: 'Driftwood Coachworks', series: { 'Class A': ['Mariner', 'Tidewater'], 'Class C': ['Harbor'], 'Class B': ['Skiff'] } },
  { name: 'Sagebrush Mfg', series: { 'Travel Trailer': ['Mesa', 'Arroyo'], 'Toy Hauler': ['Outlaw', 'Dust Devil'] } },
  { name: 'Tamarack Industries', series: { 'Class C': ['Larch', 'Kestrel'], 'Class A': ['Monarch'], 'Fifth Wheel': ['Northwind'] } },
  { name: 'Canyon Crest Coach', series: { 'Class B': ['Slickrock', 'Switchback'], 'Class C': ['Overlook'] } },
  { name: 'Bluewater Trails', series: { 'Travel Trailer': ['Cove', 'Inlet'], 'Fifth Wheel': ['Riptide'], 'Toy Hauler': ['Wake'] } },
];

export const FLOORPLAN_CODES: Record<RvClass, string[]> = {
  'Travel Trailer': ['18RB', '21FB', '24BH', '26RL', '28BH', '29RK', '31BHS', '33FL'],
  'Fifth Wheel': ['27RL', '29RK', '31RE', '34FL', '36BH', '38FK', '40BHS'],
  'Toy Hauler': ['22TH', '26G', '28FQ', '31TH', '35G', '39TH'],
  'Class C': ['22C', '24F', '26DS', '28Z', '31K', '33SW'],
  'Class B': ['19V', '20EX', '21S', '22D'],
  'Class A': ['33F', '35K', '36M', '38KB', '40U', '43Q'],
};

export const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Linda', 'Michael', 'Patricia', 'David', 'Jennifer', 'William', 'Elizabeth',
  'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Carlos', 'Karen', 'Daniel', 'Nancy',
  'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly',
  'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda',
  'Hector', 'Melissa', 'Luis', 'Deborah', 'Timothy', 'Stephanie', 'Ronald', 'Rebecca', 'Jason', 'Laura',
  'Jeffrey', 'Sharon', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela',
  'Eric', 'Shirley', 'Jonathan', 'Brenda', 'Stephen', 'Pamela', 'Larry', 'Nicole', 'Justin', 'Anna',
  'Scott', 'Samantha', 'Brandon', 'Katherine', 'Benjamin', 'Christine', 'Samuel', 'Debra', 'Gregory', 'Rachel',
  'Wei', 'Aisha', 'Omar', 'Mei', 'Raj', 'Lena', 'Diego', 'Sofia', 'Andre', 'Keiko',
  'Tyrone', 'Ingrid', 'Mateo', 'Yolanda', 'Dale', 'Gloria', 'Wade', 'Tammy', 'Duane', 'Rhea',
];

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Lindqvist', 'Haugen', 'Novak', 'Osei', 'Patel', 'Yamamoto', 'Kowalski', 'Brennan', 'Ferreira', 'Castellano',
];

export const LEAD_SOURCES = ['Website', 'Walk-in', 'Phone', 'RV Show', 'Third-party marketplace', 'Referral'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Share of *sold* leads coming from each source, and each source's close rate. */
export const SOURCE_PROFILE: Record<LeadSource, { soldShare: number; closeRate: number }> = {
  Website: { soldShare: 25, closeRate: 0.07 },
  'Walk-in': { soldShare: 25, closeRate: 0.22 },
  Phone: { soldShare: 10, closeRate: 0.12 },
  'RV Show': { soldShare: 15, closeRate: 0.14 },
  'Third-party marketplace': { soldShare: 10, closeRate: 0.04 },
  Referral: { soldShare: 15, closeRate: 0.3 },
};

export const FI_PRODUCTS = [
  { product: 'Extended Service Contract', penetration: 0.45, price: [2500, 6500], costPct: [0.4, 0.55], financedOnly: false },
  { product: 'GAP', penetration: 0.5, price: [695, 1195], costPct: [0.28, 0.4], financedOnly: true },
  { product: 'Tire & Wheel', penetration: 0.25, price: [600, 1400], costPct: [0.3, 0.4], financedOnly: false },
  { product: 'Roadside', penetration: 0.3, price: [250, 600], costPct: [0.25, 0.35], financedOnly: false },
  { product: 'Appearance Protection', penetration: 0.2, price: [800, 1800], costPct: [0.2, 0.3], financedOnly: false },
] as const;

export interface JobTemplate {
  code: string;
  description: string;
  flag: [number, number];
  parts: [number, number];
}

export const JOBS: Record<'PDI' | 'Recon' | 'Warranty' | 'Customer Pay', JobTemplate[]> = {
  PDI: [
    { code: 'PDI', description: 'Pre-delivery inspection', flag: [3, 6], parts: [0, 120] },
    { code: 'PDI-LP', description: 'LP system leak test', flag: [0.5, 1], parts: [0, 25] },
  ],
  Recon: [
    { code: 'RECON-DET', description: 'Recon - full detail', flag: [3, 8], parts: [40, 180] },
    { code: 'RECON-ROOF', description: 'Recon - reseal roof', flag: [2, 6], parts: [120, 450] },
    { code: 'RECON-APPL', description: 'Recon - appliance repair', flag: [1, 4], parts: [80, 900] },
    { code: 'RECON-TIRE', description: 'Recon - replace tires', flag: [1, 2], parts: [600, 1600] },
    { code: 'RECON-SEAL', description: 'Recon - water damage repair', flag: [4, 14], parts: [200, 1800] },
  ],
  Warranty: [
    { code: 'WAR-SLIDE', description: 'Warranty - slide-out adjust/repair', flag: [1.5, 6], parts: [0, 700] },
    { code: 'WAR-WATER', description: 'Warranty - water leak', flag: [2, 8], parts: [30, 400] },
    { code: 'WAR-ELEC', description: 'Warranty - 12V electrical', flag: [1, 4], parts: [20, 300] },
    { code: 'WAR-APPL', description: 'Warranty - appliance', flag: [1, 3], parts: [100, 900] },
  ],
  'Customer Pay': [
    { code: 'CP-AC', description: 'Roof A/C service', flag: [1, 3], parts: [0, 1100] },
    { code: 'CP-BRAKE', description: 'Brake and bearing service', flag: [2, 4], parts: [90, 450] },
    { code: 'CP-GEN', description: 'Generator service', flag: [1, 2.5], parts: [40, 250] },
    { code: 'CP-AWNING', description: 'Awning repair/replace', flag: [1, 3], parts: [150, 1400] },
    { code: 'CP-HITCH', description: 'Hitch install', flag: [1.5, 3], parts: [300, 1500] },
    { code: 'CP-WINTER', description: 'Winterize', flag: [1, 1.5], parts: [15, 40] },
    { code: 'CP-DEWINTER', description: 'De-winterize and sanitize', flag: [1, 1.5], parts: [10, 35] },
    { code: 'CP-ROOF', description: 'Roof inspection and reseal', flag: [2, 5], parts: [120, 450] },
    { code: 'CP-TIRES', description: 'Tire replacement', flag: [1, 2], parts: [600, 1800] },
    { code: 'CP-SOLAR', description: 'Solar package install', flag: [4, 8], parts: [1200, 3500] },
  ],
};

export const TRAINING_COURSES: { course: string; roles: string[] | 'all' }[] = [
  { course: 'Harassment Prevention', roles: 'all' },
  { course: 'Workplace Safety', roles: 'all' },
  { course: 'Customer Privacy & Safeguards', roles: ['Sales', 'Sales Manager', 'F&I Manager', 'General Manager', 'Service Advisor', 'Data Analyst', 'Data Engineer', 'Data Scientist'] },
  { course: 'F&I Compliance', roles: ['F&I Manager', 'Sales Manager', 'General Manager'] },
  { course: 'Propane Systems Safety', roles: ['Technician', 'Porter', 'Service Manager'] },
  { course: 'RV Walkthrough Certification', roles: ['Sales', 'Porter', 'Service Advisor'] },
  { course: 'DMS Basics', roles: ['Service Advisor', 'Parts', 'Sales', 'F&I Manager'] },
];
