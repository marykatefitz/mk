# Dealer Quest

A pixel-art RPG that teaches **real, advanced SQL** at **Summit Trail RV**, a fictional 12-store RV dealer group. Walk the campus, talk to the GM, the Sales Manager, the Service Manager, the F&I Manager and the rest of the staff, solve their problems at in-world terminals against a real in-browser database, and beat data monsters like the **Duplicate Lead Hydra** and the **Fan-Out Phantom**.

Everything runs in the browser: no backend, no accounts. Progress is saved locally, with Export/Import for backups.

## What's in Phase 1 (SQL)

- **7 departments + a Final Boss**: The Lot · Sales Floor · Service Bay · F&I Office · Floorplan Vault · Data Detective HQ · People Ops · the Monthly Ops Review.
- **71 challenges**, mixing these types:
  - **Write it**: write a query from a business question.
  - **Read it**: read a query and pick what it returns.
  - **Fix it**: find and fix the bug in a broken query.
  - **Predict it**: guess a row count or value before running.
  - **Stakeholder quests**: clarify a vague request, investigate, flag bad data to the Data Engineer, then present a 3-sentence answer.
- **15 boss battles**: turn-based, with HP, timers, crits and S–C grades.
- **Query X-Ray**: re-runs your query in logical order (FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → QUALIFY → ORDER BY → LIMIT), showing row counts, previews, plain-English captions and fan-out warnings.
- **Untangle**: reformats any query with color-coded clauses and plain-English comments.
- **Answer checker**: lets you use your own column aliases and gives specific feedback ("You have 6 rows, expected 3. Did your join fan out?").
- **Schema explorer**: an ERD of all 14 tables, dealer-terms column descriptions and 10-row previews.
- **Dealer Codex**: 39 terms, from floorplan, curtailment, PVR and penetration to sentinel values and composite keys.
- **Arcade**: 5 minigames (Clause Order, Join Jam, Bug Hunt, Row Count Roulette, Lingo Match).
- **RPG layer**:
  - Progression: XP and levels with titles, coins and 3-tier hints, golden query cards, 32 achievements.
  - Retention: daily quests with streaks, a skill tree, a trophy room, 3 save slots.
  - World: a day/night cycle and RV Show weekends with double coins.
- **Controls**: keyboard, touch joystick and gamepad.
- **Snowflake ↔ DuckDB** side-by-sides wherever the syntax differs (DATEADD, DATEDIFF, IFF, QUALIFY, FLATTEN…).

## The data

A seeded generator (`src/data/generator`) builds the same database on every load:
- **Scope**: 12 stores, ~1,550 units and ~1,200 deals over July 2024 – June 2026.
- **Service**: ~7,300 work orders and ~10,900 job lines.
- **CRM and HR**: ~9,800 leads and ~450 employees.
- **Floorplan**: floorplan loans and curtailments.

The game's "today" is fixed at **2026-06-30** (`as_of_date()`), so answers never change.

The messy parts are deliberate, and a challenge finds each one:
- ~310 duplicate lead numbers from a "2025 CRM migration".
- `-1` sentinel keys.
- Orphan job lines and deals.
- NULL dates.
- Recon cost that never posted to the unit.
- Work-order numbers that repeat per store (a composite key).

The data also tells a story: Boise has the worst aging, Phoenix the most curtailment exposure, and Tucson the weakest F&I.

## Tech

- Vite + React + TypeScript.
- **Phaser 3** for the overworld, with all pixel art generated procedurally in code.
- **DuckDB-WASM** as the SQL engine, lazy-loaded when you first need a terminal.
- CodeMirror 6 for the editor.
- Tone.js for the chiptune music, plus WebAudio sound effects.
- Zustand for state.
- `vite-plugin-pwa` for offline support and installing to the home screen.

## Setup

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # generator, checker, every challenge's reference solution, minigames
npm run build        # production build in dist/
npm run preview      # serve the build locally
npm run e2e          # Playwright playthrough (phone + desktop)
```

Dev shortcut: `http://localhost:5173/?slot=0&skipintro&unlockall` jumps straight into a save with every department unlocked.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new> → **Import** the repo. Vercel detects Vite. The build command is `npm run build` and the output directory is `dist` (already set in `vercel.json`).
3. Click **Deploy**. There are no environment variables or backend to set up.
4. On your iPhone, open the URL in Safari → **Share** → **Add to Home Screen**. After the first load (which downloads the ~8 MB compressed SQL engine), the game works offline.

CLI alternative: `npm i -g vercel && vercel --prod`.

## Project layout

```
src/
  core/            progression, saves, codex, characters, dialogue, audio, unlock rules
  data/            schema + seeded data generator
  engines/         SQL engine interface, DuckDB WASM (browser) + Node (tests)
  departments/sql/ challenges (worlds/), checker, X-Ray, Untangle, parser
  game/            Phaser scenes, procedural sprites, campus layout
  minigames/       arcade games
  ui/              React screens, terminal, bosses, overlays
tests/             Vitest unit tests + Playwright e2e
```

Later phases (Excel, Python, Data Engineering, Snowflake, JSON/Markdown, dbt, Streamlit, AI/LLMs, Git, Power BI) plug in as new `departments/<id>` modules and buildings, which already appear on the map with "Coming soon" signs. See `PLAN.md` and `GDD.md`.

## Credits

- All art is procedurally generated in code (no third-party sprites).
- Music is composed in code with Tone.js (MIT).
- Fonts are bundled locally via Fontsource, all under the SIL Open Font License: Press Start 2P, Silkscreen, Inter and JetBrains Mono.
- DuckDB-WASM (MIT), Phaser (MIT), CodeMirror (MIT), sql-formatter (MIT).
- Summit Trail RV, every person, brand and lender, and every number are fictional.
