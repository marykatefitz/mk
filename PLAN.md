# Dealer Quest: Phase 1 Build Plan

> Status: **draft for approval**. See `GDD.md` for the game design. Nothing is built until you approve both.

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| App shell | Vite + React 18 + TypeScript (strict) | |
| Overworld | Phaser 3 | Mounted in a React component. Talks to React through a small typed event bus. |
| SQL engine | `@duckdb/duckdb-wasm` | Lazy-loaded when you first enter a SQL building, behind a loading screen with dealer tips. |
| Editor | CodeMirror 6 (`@codemirror/lang-sql`) | Schema-aware autocomplete |
| Formatting (Untangle) | `sql-formatter` + our own clause annotator | |
| SQL parsing (X-Ray) | DuckDB's own `json_serialize_sql()` | Returns the parse tree from the same engine that runs the query, so there's no second parser to disagree with it. |
| State | Zustand, persisted to localStorage (3 slots) | Export/Import JSON |
| Audio | Tone.js | Lazy-loaded after first gesture |
| PWA / offline | `vite-plugin-pwa` (Workbox) | Precaches the app, the DuckDB wasm and fonts |
| Tests | Vitest (unit, running DuckDB in Node via `@duckdb/node-api`) + Playwright (e2e, phone and desktop viewports) | |
| Deploy | Vercel (static) | `vercel.json` sets COOP/COEP headers for the multithreaded DuckDB build, and the app falls back to the single-thread build without them. |

## 2. File structure

```
dealer-quest/
├─ GDD.md  PLAN.md  README.md  CREDITS.md
├─ index.html  vite.config.ts  vercel.json  tsconfig.json
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/ (192, 512, maskable, apple-touch-icon)
│  └─ fonts/
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ core/                      # engine-agnostic game systems, shared by every phase
│  │  ├─ departments/            # ★ plug-in registry: each phase = one Department module
│  │  │  ├─ types.ts             #   Department, Terminal, Challenge<T>, Checker<T> interfaces
│  │  │  └─ registry.ts
│  │  ├─ progress/               # XP, levels, coins, skill tree, achievements, dailies, save slots
│  │  ├─ quests/                 # quest log, story flags, unlock rules
│  │  ├─ dialogue/               # dialogue scripts (typed), choices, portraits
│  │  ├─ codex/                  # glossary terms + unlock state
│  │  ├─ stakeholder/            # clarify → investigate → flag → present engine + scorer
│  │  ├─ boss/                   # turn-based battle state machine (engine-agnostic)
│  │  └─ audio/                  # Tone.js music + SFX, volume buses
│  ├─ data/
│  │  ├─ generator/              # ★ seeded, deterministic data generator
│  │  │  ├─ rng.ts               #   mulberry32 + helpers (pick, weighted, normal, dateBetween)
│  │  │  ├─ locations.ts units.ts floorplan.ts customers.ts leads.ts deals.ts
│  │  │  ├─ fi.ts employees.ts hr.ts service.ts messiness.ts
│  │  │  └─ index.ts             #   generateDataset(seed) → typed row arrays
│  │  ├─ schema.sql              #   DDL + column comments (drives schema explorer + autocomplete)
│  │  └─ dictionary.ts           #   column → dealer-terms meaning
│  ├─ engines/
│  │  └─ duckdb/                 # lazy loader, load dataset via Arrow, query runner, X-Ray, as_of macro
│  ├─ departments/
│  │  └─ sql/                    # ★ Phase 1 department
│  │     ├─ worlds/w1-lot.ts … w7-hr.ts, final-boss.ts   # challenge definitions
│  │     ├─ checker/             # result comparator + feedback heuristics
│  │     ├─ xray/                # logical-order step builder
│  │     ├─ untangle/            # formatter + plain-English annotator
│  │     ├─ translations.ts      # Snowflake ↔ DuckDB pairs
│  │     └─ terminal/            # SQL terminal React panel
│  ├─ minigames/                 # clause-order, join-jam, bug-hunt, row-roulette, lingo-match
│  ├─ game/                      # Phaser: scenes (Boot, Campus, Interior), player, NPCs, day/night, input
│  │  ├─ sprites/                # procedural sprite + palette-swap generators
│  │  └─ maps/                   # tilemap JSON (Tiled-format), per building
│  └─ ui/                        # React HUD, menus, dialogue box, boss screen, settings, theme
└─ tests/
   ├─ generator.test.ts          # determinism, row counts, referential rules, planted messiness exists
   ├─ checker.test.ts            # alias tolerance, order sensitivity, float tolerance, feedback text
   ├─ challenges.test.ts         # every reference solution runs and returns ≥1 row; every Fix-it starter is actually wrong
   └─ e2e/                       # Playwright: new game → World 1 → boss, at 390×844 and 1440×900
```

**How later phases plug in:** each phase is a `Department` module:

```ts
interface Department {
  id: 'sql' | 'excel' | 'python' | 'dataeng' | 'snowflake' | 'jsonmd' | 'dbt' | 'streamlit' | 'ai' | 'git' | 'bi';
  building: BuildingId;                  // where it sits on the campus map
  loadEngine(): Promise<EngineHandle>;   // lazy (DuckDB, HyperFormula, Pyodide, stlite…)
  Terminal: React.ComponentType<TerminalProps>;
  worlds: World[];                       // challenges share one Challenge<Payload> shape
  check(challenge, attempt, engine): Promise<CheckResult>;  // same feedback contract for every track
  skillTree: SkillNode[];
}
```

XP, coins, codex, quests, bosses, Stakeholder Mode, save slots and the map are all in `core/` and don't care which department is active. Adding Excel means adding `departments/excel/` and flipping its building from "Coming soon" to open.

## 3. Database schema (DuckDB)

**Data window:** 2024-07-01 → 2026-06-30. The game's "today" is **2026-06-30** (month-end, ops-review day), exposed as the macro `as_of_date()` so results never drift with the real clock. Lessons explain that at work you'd write `CURRENT_DATE`.

Seed: `20240701`. Row counts are approximate targets, and tests pin the exact values.

| Table | Key(s) | ~Rows | Notes |
|---|---|---|---|
| `locations` | location_id | 12 | 4 regions (Mountain, Southwest, Midwest, Southeast). Stores opened 1998–2022. |
| `units` | stock_no (e.g. `N24-01234` / `U25-00456`) | 1,500 | 17-char VINs (check digit not enforced; the lesson notes this). Class mix: TT 40%, 5W 20%, Class C 12%, Class A 8%, Class B 8%, Toy Hauler 12%. New 65% / Used 35% (used units come in mostly via trade). |
| `floorplan_loans` | floorplan_id | ~950 | New units always floored, some used. 3 fictional lenders. Rates 6.5–9.25%. Paid off at sale + 0–10 days. |
| `curtailments` | curtailment_id | ~1,400 | 10% of principal at day 180, then 5% every 90 days. ~80% paid on time, ~12% late, ~8% unpaid as of today. |
| `customers` | customer_id | ~3,200 | Fictional names from a mixed name list, so no real people |
| `leads` | lead_id (surrogate), lead_number (business) | ~9,000 | Realistic funnel with ~12% close rate overall, varying by source (Referral and Walk-in highest, Third-party marketplace lowest). **~4% of lead_numbers duplicated** by the "2025-03 CRM migration" (second copy has a new lead_id and a slightly different status, created_date or assigned employee). |
| `deals` | deal_id | ~1,150 | Includes ~450 trades, which become used units. Status mix: 93% Funded, 4% Pending, 3% Unwound. |
| `fi_products` | (deal_id, product) | ~1,600 | Penetration rates: ESC ~45%, GAP ~35% (financed deals only), Tire & Wheel ~25%, Roadside ~30%, Appearance ~20% |
| `employees` | employee_id | ~260 | 12 GMs; corporate staff with NULL location_id; manager_id tree 4 levels deep; turnover spikes in sales and seasonal porters |
| `pay_history` | (employee_id, effective_date) | ~700 | Fictional rates. Raises happen annually or on promotion. |
| `time_off` | time_off_id | ~1,800 | |
| `training_completions` | (employee_id, course, completed_date) | ~2,000 | Compliance courses such as "Privacy Safeguards" and "F&I Compliance" |
| `work_orders` | **(wo_number, location_id)** | ~9,000 | WO numbers restart at 10001 per store, so a key collision is guaranteed. Mix: Customer Pay 55%, Warranty 20%, Internal 25%. |
| `wo_jobs` | job_id | ~20,000 | Flag hours vs actual hours: tech efficiency is typically 85–140% (Earl is 160%). Labor rates $149–$189 per hour by store. |

**Planted messiness (each has at least one challenge that finds it):**

- `deals.salesperson_id = -1` on ~2% of deals, and `leads.assigned_employee_id = -1` on ~3% of leads. These are **sentinel "unknown" values**, and there's no employee -1.
- `deals.lead_id` is NULL for ~20% of walk-ins. That's legitimate, and a lesson covers NULL vs sentinel.
- **Orphans:** ~15 `wo_jobs` with no header, and ~5 deals pointing to a `customer_id` that doesn't exist.
- **Missing dates:** ~10 units have NULL `received_date`, and ~20 closed WOs have NULL `closed_date`.
- **Recon drift:** ~120 used units have internal WO parts plus labor, but `units.recon_cost` is 0 or NULL.
- **Store-level texture for the final boss:** one store with bad aging, one with high curtailment exposure, and one with weak F&I. These are deliberately different stores, so the GM's question needs real multi-step analysis.

## 4. Challenge list (71 challenges + a 5-phase Final Boss, plus 14 boss fights)

Legend: **W** = Write it · **R** = Read it · **F** = Fix it · **P** = Predict it · **S** = Stakeholder quest · ⚔️ = mini-boss / 👑 = boss (each is a 3–5 question fight drawn from its world's concepts).

### World 1: The Lot (Rhonda, Scout). SELECT, WHERE, ORDER BY, LIMIT, DISTINCT, LIKE, BETWEEN, NULL
| # | Type | Challenge |
|---|---|---|
| 1.1 | W | **First walk of the lot:** the first 10 units, all columns |
| 1.2 | W | **Where's N25-00412?** Find one stock number. |
| 1.3 | W | **New Class A units in stock**, most expensive MSRP first |
| 1.4 | W | **Which manufacturers do we carry?** (DISTINCT) |
| 1.5 | R | IN list plus ORDER BY on two columns: which row comes first? |
| 1.6 | W | **Units received in Q1 2026** (BETWEEN on dates) |
| 1.7 | W | **Customer knows the last 6 of the VIN** (LIKE / ILIKE) |
| 1.8 | F | `WHERE received_date = NULL` returns nothing. Why? |
| 1.9 | P | How many used toy haulers are in stock at the Denver store? |
| 1.10 | W | **Markup check:** MSRP − invoice as a computed, aliased column, top 10 |
| ⚔️ | | *Stock Number Shuffler:* 3 lookup rounds |
| 👑 | | *The Null Gremlin:* NULL-aware filters, IS NULL / COALESCE |

### World 2: The Sales Floor (Tony). GROUP BY, HAVING, COUNT/SUM/AVG, date functions, COUNT_IF
| 2.1 | W | **Units sold per store** (funded deals) |
| 2.2 | W | **Sales by month** (`DATE_TRUNC`, the same in Snowflake) |
| 2.3 | W | **Average front gross by salesperson**, best first |
| 2.4 | W | **Leads by source** |
| 2.5 | W | **Close rate by source** (`COUNT_IF` in both engines, and `AVG(CASE…)`) |
| 2.6 | F | WHERE vs HAVING: "stores with more than 100 deals" |
| 2.7 | F | Column must appear in GROUP BY |
| 2.8 | R | A multi-column GROUP BY with HAVING: which question does it answer? |
| 2.9 | P | How many (store, month) groups have zero Class B sales? (trick: they don't appear) |
| 2.10 | S | **"Why are sales down?"** Clarify with Tony, compare YoY by month |
| ⚔️ | | *WHERE/HAVING Wraith* |
| 👑 | | *The Stalled Funnel:* lead funnel counts and close rates |

### World 3: The Service Bay (Priya, Earl). INNER/LEFT joins, anti-joins, composite keys
| 3.1 | W | **Jobs with store name** (first join) |
| 3.2 | F | WO header → jobs joined on `wo_number` only: the numbers explode. Add `location_id`. |
| 3.3 | W | **Labor sales by bill type** (Customer Pay / Warranty / Internal) |
| 3.4 | W | **Tech efficiency** (flag hrs ÷ actual hrs) per tech, with the name from employees |
| 3.5 | W | **Effective labor rate** by store (labor $ ÷ flag hours) |
| 3.6 | W | **Parts gross** by bill type |
| 3.7 | W | **Anti-join:** in-stock new units with no PDI work order |
| 3.8 | W | **Recon drift:** internal WO recon $ vs `units.recon_cost` |
| 3.9 | R | LEFT JOIN plus a WHERE on the right table: what does it silently become? |
| 3.10 | P | Row count of a LEFT JOIN from units to work orders |
| ⚔️ | | *Composite Key Crab* |
| 👑 | | *The Fan-Out Phantom:* spot and fix double-counting joins |

### World 4: The F&I Office (Walt). CASE WHEN, conditional aggregation, calculated metrics
| 4.1 | W | **Label each deal** Cash / Financed with CASE (plus a Snowflake `IFF` translation) |
| 4.2 | W | **Back-end gross per deal** (sum of F&I product sale − cost) |
| 4.3 | W | **Front vs back gross by store** |
| 4.4 | W | **Total PVR and F&I PVR by store** (retail funded units only, excluding unwinds) |
| 4.5 | W | **Service contract penetration %** by store |
| 4.6 | W | **Finance vs cash mix** with conditional aggregation in one row per store |
| 4.7 | W | **Over-allowance on trades** (allowance − ACV), worst first |
| 4.8 | F | Summing `front_gross` after joining fi_products double-counts it |
| 4.9 | R | A nested CASE penetration report: what does the 3rd column mean? |
| 4.10 | S | **"Is F&I slipping at Tucson?"** Clarify, compute, present |
| ⚔️ | | *Over-Allowance Ogre* |
| 👑 | | *The PVR Pirate* |

### World 5: The Floorplan Vault (Marge). Date math, CTEs, subqueries
| 5.1 | W | **Days in stock** per in-stock unit (`DATE_DIFF` ↔ Snowflake `DATEDIFF`) |
| 5.2 | W | **Aging buckets** 0–90 / 91–180 / 181–270 / 270+ |
| 5.3 | W | **CTE:** aging by store with % over 180 days |
| 5.4 | W | **Curtailments due in the next 30 days** |
| 5.5 | W | **Late or unpaid curtailments** with days late |
| 5.6 | W | **Flooring interest to date** per unit (principal × rate ÷ 365 × days) |
| 5.7 | W | **Units hitting their first curtailment within 30 days** (days 150–180) |
| 5.8 | W | **Subquery:** units whose interest cost exceeds their store's average |
| 5.9 | R | A correlated subquery: which units does it return? |
| 5.10 | F | Snowflake `DATEADD(day, 90, d)` pasted into DuckDB. Translate it. |
| ⚔️ | | *Aging Anaconda* |
| 👑 | | *The Curtailment Collector* |

### World 6: Data Detective HQ (Devin). Window functions and data quality
| 6.1 | W | **Find duplicate lead_numbers** (GROUP BY … HAVING COUNT(*) > 1) |
| 6.2 | W | **Deduplicate with ROW_NUMBER()**, keeping the latest row |
| 6.3 | W | **Same thing with `QUALIFY`** (Snowflake-native) |
| 6.4 | W | **-1 sentinels:** count them, then `NULLIF` them away |
| 6.5 | W | **Orphans:** jobs with no header, deals with no customer |
| 6.6 | W | **Running total** of units sold by month |
| 6.7 | W | **RANK salespeople** by gross within each store |
| 6.8 | W | **LAG:** month-over-month change in units sold |
| 6.9 | W | **Percent of total** with `SUM() OVER ()` |
| 6.10 | R | A 3-month moving average (`ROWS BETWEEN 2 PRECEDING…`): which months are partial? |
| 6.11 | S | **"The close rate looks too low."** Find the duplicates and flag them to Devin. |
| ⚔️ | | *Sentinel Specter* |
| 👑 | | *The Duplicate Lead Hydra* |

### World 7: HR & People Ops (Jess). Self-joins, date math, cohorts
| 7.1 | W | **Active headcount by department** |
| 7.2 | W | **Org chart:** employee → manager name (self-join) |
| 7.3 | W | **Average tenure** of active employees by role |
| 7.4 | W | **2025 turnover rate** (terminations ÷ average headcount) |
| 7.5 | W | **Headcount by month** (`generate_series` of month-ends joined to hire and term ranges) |
| 7.6 | W | **Seasonal staffing** around RV-show months |
| 7.7 | W | **Current pay rate** per employee (latest pay_history row with QUALIFY) |
| 7.8 | W | **Recursive CTE:** everyone under a regional GM |
| 7.9 | F | Active-employee filter drops everyone with a NULL termination_date |
| 7.10 | R | Hire-cohort retention query: what does row 3 say? |
| ⚔️ | | *Orphaned Org Chart* |
| 👑 | | *The Turnover Tornado* |

### Final Boss: The Monthly Ops Review (Rhonda). 5 phases, each a multi-step question
1. **"Which store has the worst aging?"** Percent of units over 180 days, by store.
2. **"…and the most curtailment exposure?"** Amounts due in the next 60 days plus unpaid amounts.
3. **"What's its PVR vs the group?"** Front plus back per retail unit.
4. **"Can I trust the lead numbers?"** Dedupe, then compare close rates.
5. **Present:** a 3-sentence answer (Answer → So-what → Detail), scored.

Every challenge carries: story text, the business question, concept tags, optional starter SQL, the reference SQL, 3 hints, `orderMatters`, a "why this matters at a dealership" note, and the codex terms it unlocks. For **Read it** challenges it also carries the choices and an explanation for each distractor.

## 5. Key systems

**Answer checker.** It runs the reference and the attempt and compares them this way:

1. **Column count first,** with names ignored so aliases are fine.
2. **Values normalized:** numbers rounded to 2 decimal places (4 for rates), dates as ISO, and NULL kept as its own value.
3. **Rows compared as a multiset,** or in sequence when `orderMatters`.
4. **Feedback heuristics:**
   - More rows than expected, and the query has a JOIN: "Did your join fan out?"
   - Fewer rows than expected, with an INNER JOIN or a WHERE on a nullable column: "Did a NULL or an inner join drop rows?"
   - The values match but the order doesn't: an ORDER BY hint.
   - One column is off by a constant factor: "Are you double-counting?"
   - The column count differs: "Expected 3 columns: store, units, pct."

**Query X-Ray.** The query is parsed with `json_serialize_sql` and then run as a series of cumulative stages, each showing a count and a 5-row preview:

1. `FROM`/`JOIN`s only (`SELECT *`)
2. `+ WHERE`
3. `+ GROUP BY`, shown as groups with their row counts
4. `+ HAVING`
5. `SELECT` projection
6. `ORDER BY`
7. `LIMIT`

CTEs get one step each, and window functions are annotated at the SELECT step. Captions are templated from the AST, e.g. "Keep only rows where status is 'In Stock' → 612 rows remain."

**Untangle.** The query is formatted with `sql-formatter` and each clause is colored. The annotator then writes a plain-English comment above each clause (CTE, JOIN condition, WHERE predicate, aggregate, window) from the same AST.

**Performance.**
- DuckDB loads only when you first enter a building. The dataset is generated in a Web Worker and inserted via Arrow in well under a second.
- The Phaser map uses a single atlas, and the game loop is paused while panels are open.
- The initial JS budget, excluding DuckDB, is under 400 KB gzipped.

## 6. Build milestones (Phase 1)

| # | Milestone | Done when |
|---|---|---|
| M1 | Data generator, DuckDB loader, and schema explorer | Generator tests green; ERD and preview work |
| M2 | SQL terminal, answer checker, X-Ray, Untangle, and World 1 | You can solve all of World 1 in a plain page |
| M3 | Phaser campus, player customization, NPCs, dialogue, and The Lot building | End-to-end World 1 in the game |
| M4 | Boss battle system plus 2 bosses (Null Gremlin, Fan-Out Phantom); progression, saves and audio | Boss fight playable on phone and desktop |
| M5 | Worlds 2–7, Final Boss, codex, and Stakeholder Mode | All 71 challenge references pass in tests |
| M6 | 5 minigames, PWA/offline, polish, e2e on 390×844 and 1440×900, perf pass, README and deploy | Ready to ship to Vercel |

I'll push after each milestone so you can play along.

## 7. Later phases (outline)

Each is a `departments/<id>` module plus a building on the map. Characters, XP, codex, bosses and the Stakeholder engine are all reused.

| Phase | Engine (lazy) | Terminal | Reuses |
|---|---|---|---|
| 2 Excel Office | HyperFormula | Spreadsheet grid; the checker compares cell ranges | Same dataset exported as sheets |
| 3 AI Team Lab (Python) | Pyodide + pandas | Notebook cell; the checker compares DataFrames | SQL ↔ pandas side-by-sides from `translations` |
| 4 Data Eng Basement | DuckDB | Multi-file SQL "project" view | Raw/staging/marts built as DuckDB schemas; DQ tests are SQL |
| 5 Snowflake Tower | DuckDB (simulation) plus interactive diagrams | SQL, and a simulated `SHOW` / warehouse console | Field-trip scripts for a free trial account |
| 6 JSON & Markdown | DuckDB JSON functions; a markdown renderer | Split editor and preview | JSON payload columns added to `leads` and `deals` behind a Phase 6 flag |
| 7 dbt Factory | DuckDB plus a mini Jinja/`ref()` compiler | Project tree and lineage DAG | `stg_leads → int_leads_deduped → fct_deals → mart_store_scorecard` |
| 8 Streamlit Studio | stlite | Code plus a live app pane | Store Scorecard capstone |
| 9 LLM & AI Lab | Optional user API key (localStorage only), or a canned simulation | Chat and eval panels | RAG over Markdown dealer docs; SQL agent on DuckDB |
| 10 GitHub Garage | isomorphic-git in memory | Simulated terminal and commit graph | Scenario repo containing the dbt and Streamlit projects |
| 11 BI Studio | Simplified DAX evaluator over DuckDB | Model view and measure editor; **DAX Detective** minigame | Star schema from Phase 4 |
| Career mode | — | Promotion track and cross-track skills dashboard | `core/progress` |

## 8. Decisions I need from you

1. **Repo:** this session's repo is `marykatefitz/mk`, not a new `dealer-quest` repo. Should I build here, at the root?
2. **World count:** the prompt says "6 worlds plus a final boss" but lists 7 (HR is the 7th). I've planned **7 worlds + Final Boss**. Is that okay?
3. **Art:** Kenney CC0 tile packs (fastest and most polished, but I need to download them during the build) or fully procedural sprites (no downloads, simpler look)? I recommend **Kenney for tiles and props, with procedural generation for the RVs and character palette swaps.**
4. **Power BI / DAX:** it's a separate BI Studio building (Phase 11), so DAX Detective ships then rather than in Phase 1. Is that okay?
5. **"Today" in the data:** is a fixed as-of date of 2026-06-30 fine? (This keeps answers deterministic.)
