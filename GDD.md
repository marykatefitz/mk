# Dealer Quest: Game Design Document

> Status: **draft for approval**. Nothing gets built until this and `PLAN.md` are signed off.

## 1. Pitch

You're the new data analyst at **Summit Trail RV**, a fictional 12-store RV dealer group. The data is a mess, the GM has questions, and the monthly ops review is coming. Walk the dealership campus, talk to the people who run it, solve their problems at in-world terminals with real SQL, and beat the data monsters that live in bad joins and duplicate rows.

It should play like a small Switch game (Stardew-style overworld, Pokémon-style encounters, puzzle-game feedback) and teach two things at once: **reading and writing advanced SQL** and **how an RV dealership actually makes and loses money**.

## 2. Core loop

```
Talk to NPC ──► Get a business problem ──► Walk to a terminal ──► Solve it (SQL)
     ▲                                                                  │
     │                                                                  ▼
Story advances ◄── Unlock area / NPC ◄── XP · coins · loot ◄── Feedback + dealer-lingo lesson
```

- **Session length:** 5–15 minutes. One quest is about 2–5 minutes, and a minigame about 60–90 seconds.
- **Pacing inside a building:** lesson, then 3–4 challenges, a mini-boss, 3–5 more challenges, and the boss. Stakeholder quests and minigames break it up.
- **Why come back:** daily quests with a streak, the next building to unlock, codex cards still to collect, gold-query cards for perfect solves, and bosses you can replay for a better grade.

## 3. The world

**Summit Trail RV campus**, a single top-down pixel-art map built in Phaser 3 and embedded in React.

| Building | Department (track) | Phase | Status in Phase 1 |
|---|---|---|---|
| The Lot | SQL World 1 | 1 | Playable |
| Showroom / Sales Floor | SQL World 2 | 1 | Playable |
| Service Bay | SQL World 3 | 1 | Playable |
| F&I Office | SQL World 4 | 1 | Playable |
| Floorplan Vault (Controller's office) | SQL World 5 | 1 | Playable |
| Data Detective HQ (data team floor) | SQL World 6 | 1 | Playable |
| HR & People Ops | SQL World 7 | 1 | Playable |
| GM's Conference Room | Final Boss: Monthly Ops Review | 1 | Playable |
| Arcade Trailer | Minigames | 1 | Playable |
| Accounting Office | Excel | 2 | "Coming soon" sign |
| AI Team Lab | Python | 3 | Coming soon |
| Data Engineering Basement | Data engineering | 4 | Coming soon |
| Snowflake Tower | Snowflake | 5 | Coming soon |
| JSON & Markdown Workshop | JSON/MD | 6 | Coming soon |
| dbt Factory | dbt | 7 | Coming soon |
| Streamlit Studio | Streamlit | 8 | Coming soon |
| LLM & AI Lab | AI/LLMs | 9 | Coming soon |
| GitHub Garage | Git | 10 | Coming soon |
| BI Studio | Power BI & DAX | 11 (new) | Coming soon |

**Ambient life:** RVs pull onto the lot and park, a porter washes units, lifts in the service bay go up and down with a tech under them, a flag flutters over the showroom, and a coffee machine steams in the break room.

**Day/night:** One in-game day is about 12 real minutes. Lighting shifts to golden hour and then night, when the lot lights and building windows glow. Time freezes while a terminal or dialogue is open.

**Seasonal event: RV Show Weekend.** This runs on a real-calendar schedule (e.g. the first weekend of each month) or when the player unlocks it. Tents appear on the lot, NPCs are swamped, bonus quests pay double coins, and HR's seasonal-staffing quests tie in.

## 4. Characters

Each NPC gets a 32×32 pixel portrait with 3 expressions (neutral, happy, stressed) and a voice "blip" pitch for the typewriter text.

| NPC | Role | Personality | Gives quests in |
|---|---|---|---|
| **Rhonda Vance** | General Manager | Big-picture and blunt; hates surprises. "Don't bring me a table, bring me an answer." | The Lot intro, Final Boss |
| **Tony "Two-Pens" Delgado** | Sales Manager | High energy and always closing. Talks in deal slang, secretly insecure about close rate. | Sales Floor |
| **Priya Nair** | Service Manager | Calm and systems-minded. Lives by the RO. | Service Bay |
| **Earl "Grease" Buckley** | Veteran master tech | Grumpy but lovable, with 38 years on flat-rate. Teaches flag hours with war stories. | Service Bay side quests |
| **Walt Kimura** | F&I Manager | Smooth, compliance-obsessed, knows every product's penetration by heart. | F&I Office |
| **Margaret "Marge" Okafor** | Controller | Penny-exact and fears the floorplan audit. Guards the Vault. | Floorplan Vault |
| **Devin Park** | Data Engineer | Hoodie and cold brew. "The -1s are legacy. Not my fault. Okay, partly my fault." | Data Detective HQ, gets "flag bad data" reports |
| **Jess Alvarez** | HR Lead | Warm, organized, protective of employee privacy (all pay data is fictional). | HR & People Ops |
| **Nova Reyes** | AI Lead | Enthusiastic and slightly chaotic. Appears in Phase 1 only as a teaser NPC by the locked AI Lab. | Later phases |
| **Scout** | Lot porter / tutorial buddy | Friendly, gives hints for coins, and runs the hint shop. | Everywhere |

**Player character:** a customizable 16×24 sprite with a name, skin tone, hair style and color, and shirt and pants colors (palette-swapped at runtime), plus a lanyard that changes with rank.

## 5. Terminals (where the learning happens)

Walking up to a desk computer and pressing A (or tapping) opens a full-screen React panel over the paused game.

**SQL Terminal (Phase 1)**
- CodeMirror 6 editor with SQL highlighting and autocomplete for tables and columns, taken from the live DuckDB schema.
- Run with ⌘/Ctrl+Enter or a big chunky **RUN** button. Results appear in a paged grid.
- Panels: **Quest** (story and business question), **Schema** (mini-ERD), **Hints**, **Codex**.
- **Query X-Ray** toggle: a step-by-step logical execution walkthrough (FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT) with a row count and 5-row preview at each step, plus a plain-English caption. CTEs are X-rayed one at a time.
- **Untangle** button: reformats the query, color-codes each clause, and adds `-- plain English` comments above each part.
- **Snowflake ↔ DuckDB** tab: shown whenever a lesson uses syntax that differs between the two (IFF, DATEADD, DATEDIFF, FLATTEN, `:` paths, and so on).

## 6. Challenge types

| Type | What you do | Win condition |
|---|---|---|
| **Write it** | Write a query from a business question | Result matches the reference (columns, rows, order if required) |
| **Read it** | Read a gnarly query and pick what it returns or what question it answers | Correct choice (4 options, distractors built from common misreads) |
| **Fix it** | Edit a broken or wrong query | Fixed query's result matches the reference |
| **Predict it** | Guess the row count or a value, then run it to see | Within tolerance (exact for counts, ±1% for values) |
| **Speed round** | Boss phases on a timer | Correct before the timer ends |

## 7. Combat: boss battles

Bosses are turn-based encounters with a Pokémon-style layout: boss sprite top right, player bottom left, HP bars, and a command menu. The "attack" is the SQL terminal, docked in the bottom half of the screen.

- **Player HP:** 100. A wrong answer costs 15, a timeout 20, and a hint 5, 10 or 15 depending on tier.
- **Boss HP:** split into 3 phases. Each correct answer deals damage scaled by speed, and a perfect first try is a crit that shakes the screen.
- **Phases** change the boss sprite and its attack flavor. For example, the Hydra grows a head for every duplicate your query leaves in.
- **Defeat:** keep your XP from correct answers, lose half the coins earned in the fight, and retry with the same questions reshuffled.
- **Victory:** a cutscene (the boss dissolves into clean rows), a loot chest, and a grade from S to C based on HP left, hints used and time.

| World | Mini-boss | Boss | Mechanic flavor |
|---|---|---|---|
| 1 The Lot | Stock Number Shuffler | **The Null Gremlin** | Hides rows behind NULLs; `= NULL` attacks fizzle |
| 2 Sales Floor | The WHERE/HAVING Wraith | **The Stalled Funnel** | Leads leak out of the funnel each turn |
| 3 Service Bay | The Composite Key Crab | **The Fan-Out Phantom** | Clones itself for every duplicated join row |
| 4 F&I Office | The Over-Allowance Ogre | **The PVR Pirate** | Steals back-end gross until you compute it right |
| 5 Floorplan Vault | The Aging Anaconda | **The Curtailment Collector** | Charges interest (damage) every turn it isn't paid |
| 6 Data Detective HQ | The Sentinel Specter | **The Duplicate Lead Hydra** | Grows heads for every duplicate row left in |
| 7 HR & People Ops | The Orphaned Org Chart | **The Turnover Tornado** | Sweeps employees away; you must count them |
| Final | — | **The Monthly Ops Review** (Rhonda and "The Board") | 5 multi-step phases combining every skill |

## 8. Stakeholder Mode (soft skills)

Some quests start vague on purpose and play as a dialogue-driven mini-adventure:

1. **Clarify:** the NPC says "Why are sales down?" and you pick 2 of 5 clarifying questions (e.g. "Down compared with what period?", "Units or gross?", "Which stores?"). Good picks narrow the task, and bad picks waste a "patience" meter.
2. **Investigate:** run SQL. Some quests contain planted bad data (duplicate leads, -1 keys).
3. **Flag:** walk to Devin and report the issue with a structured form (what, where, impact). Flagging early earns a bonus.
4. **Present:** build a 3-sentence answer (**Answer → So-what → Detail**) from sentence cards. It's scored on order, specificity (numbers included) and brevity, with written feedback.

**"Stuck?" moment:** if you've been on a challenge for more than 4 minutes or failed it 3 times, Scout pops up and asks, "You've been stuck a while. Who do you ask?" Picking the right person (Devin for data issues, the business owner for definitions) gives a free targeted hint and the *Asks Early* badge progress. Grinding silently gives nothing, which teaches that asking early is a skill.

## 9. Minigames (in the Arcade Trailer and as boss interludes)

| Minigame | Phase 1? | Play |
|---|---|---|
| **Clause Order** | ✅ | Drag clause chips into *logical* execution order against a 30s clock. Levels add CTEs, QUALIFY and window functions. |
| **Join Jam** | ✅ | Drag lines between key columns of two table cards. Later levels use composite keys (wo_number + location_id) and decoy columns. |
| **Bug Hunt** | ✅ | Tap the buggy token in a query before time runs out. Explains the bug afterwards. |
| **Row Count Roulette** | ✅ | Spin up a query and bet coins on the row-count bracket. |
| **Lingo Match** | ✅ | Memory card flip, pairing dealer terms with definitions. Only unlocked codex terms appear. |
| **DAX Detective** | ⏳ (BI Studio) | Figure out the filter context. Depends on the DAX evaluator, so it ships with the BI Studio. |

## 10. Progression

- **XP and levels (1–50) with titles:** Lot Porter (1) → Detail Tech (4) → BDC Rep (8) → Sales Consultant (12) → Service Advisor (16) → F&I Manager (21) → Sales Manager (26) → Controller (31) → General Manager (38) → Dealer Principal (45+).
- **Coins:** earned from challenges, bosses and dailies. Spent on hints (10/25/50), cosmetics and minigame bets.
- **Skill tree per track:** SQL is live in Phase 1. Excel, Python, Snowflake, dbt, Streamlit, AI, Git, Power BI and Communication are shown greyed out. SQL nodes (SELECT basics, Aggregation, Joins, Conditional logic, Dates, CTEs & subqueries, Windows, Data quality, Self-joins) fill in as you clear concept tags. Communication fills from Stakeholder Mode.
- **Inventory:** badges, boss trophies, and **golden query cards** (awarded for a first-try solve with no hints; each shows your query framed as a collectible).
- **Achievements:** around 30 in Phase 1 (e.g. *No Fan-Out Zone*, *Hydra Slayer*, *Asked Early ×5*, *7-Day Streak*).
- **Daily quests:** 3 per day (e.g. "Solve 2 Read-it challenges", "Play Lingo Match") with a streak counter and freeze tokens.
- **Quest log, codex, and 3 save slots.** Saved to localStorage, with Export/Import as JSON.

## 11. Art direction

- **Resolution:** a 16×16 tile grid at a 320×180 internal resolution, integer-scaled. Crisp pixels (`image-rendering: pixelated`).
- **Palette:** a bright, warm 32-color palette (sunny asphalt greys, campground greens, RV cream/teal/orange accents).
- **Assets:** CC0 only, either Kenney.nl packs (e.g. *Tiny Town*, *RPG Urban Pack*) or procedurally generated sprites. RV sprites are procedurally generated per class and color so each unit on the lot can reflect real inventory. All sources are credited in the README.
- **UI panels:** chunky rounded cards, 3px outlines, a drop "lip" on buttons that squishes on press, and bouncy spring easing.
- **Fonts:** pixel font (*Press Start 2P* or *Silkscreen*, OFL) for game text and headings. *Inter* for lessons and *JetBrains Mono* for code (both OFL). Everything is bundled locally so it works offline.
- **Light and dark themes** for UI panels. The overworld follows the day/night cycle instead.
- **Motion:** particles on correct answers, screen shake on boss crits, and a confetti fanfare on level-up. All of it is disabled or reduced under `prefers-reduced-motion`.

## 12. Sound

- **Tone.js**-generated chiptune: an overworld theme (day and night variants), a terminal "focus" loop, a boss theme, and a victory jingle. Everything is composed in code, so there are no licensing questions.
- **SFX:** menu blip, typewriter blips, run query, correct (rising arpeggio), wrong (soft buzz, never punishing), coin, level-up fanfare, and boss hit and crit.
- **Separate Music and SFX volume sliders,** plus mute. Audio starts only after the first user gesture (an iOS requirement).

## 13. Controls

- **Keyboard:** WASD/arrows to move, E/Space/Enter to interact, Esc for the menu.
- **Touch:** a virtual joystick on the left and an A button on the right, auto-shown on touch devices.
- **Gamepad** (Gamepad API): left stick or d-pad to move, A to interact, B to go back, Start for the menu.
- **Terminal on phone:** the editor gets a custom SQL key bar (`SELECT`, `FROM`, `WHERE`, `*`, `(`, `)`, `'`, `,`, table names).

## 14. Accessibility

Reduced motion, a colorblind-safe feedback style (icons as well as colors), adjustable text speed, readable-font mode for dialogue, full keyboard access to every panel, and no hard time limits outside speed rounds and bosses (with an optional "relaxed timers" setting).
