# Team Longevity Analysis Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained `team-longevity.html` (hand-rolled D3, embedded data, all client-side) exploring FRC team survival and the acquisition-vs-retention question, 2002–2026, nationally.

**Architecture:** A Python pull (`pull_participation.py`) writes `team_participation.json` from TBA, caching every HTTP response durably under `cache/tba/`. A tested pure-JS compute module (`compute.js`) derives every series from a compact per-team record array. `build.py` inlines D3 + `compute.js` + the embedded records into `template.html`, producing the one-file deliverable.

**Tech Stack:** Python 3 (stdlib only) for the pull/build; vanilla JS + D3 v7 (vendored, inlined) for the tool; Node for unit-testing `compute.js`.

## Global Constraints

- **Data window:** 2002–2026 inclusive (2026 season complete).
- **Active** = played ≥1 official event (TBA event types 0–5). **Lifespan** = first→last active year, interior gaps count alive. **Confirmed dead** = last active ≤ END_YEAR−2. **Cohort** = TBA `rookie_year` in 2002–2026. **Provisional** = 2025–2026 (hatched/dimmed in every view).
- **TBA cache is durable and shared:** all TBA responses cached under repo `cache/tba/` (keyed by URL SHA1). Never re-pull a cached URL. TBA key at `~/thebluealliance_api_key.txt`.
- **Single-file output:** `team-longevity.html` must be self-contained — no network calls at runtime, D3 and data inlined.
- **Age bands** (used in retention/composition views): `age 1` (a==0), `2–3` (1–2), `4–6` (3–5), `7–10` (6–9), `11–15` (10–14), `16+` (≥15). Age measured as `year − rookie_year`.
- **Golden values** (from validated first-cut analysis; used in tests): active[2020]=3904; pooled year-2 survival ≈74.3%; median completed lifespan =3; age-16+ field share 2026 ≈28%; standardized departure rate 2022 ≈21.7%; US rookies −37% (2016–19 vs 2023–26).

---

### Task 1: Durable TBA pull

**Files:**
- Create: `longevity/pull_participation.py`
- Data out: `longevity/team_participation.json`
- Cache: `cache/tba/` (durable, gitignored)

**Interfaces:**
- Produces `team_participation.json`: `{start_year, end_year, pull_date, teams: {"<num>": {rookie_year, state, country, years: [int...]}}}` — only in-window teams that played ≥1 official event.

- [ ] **Step 1:** Promote the working pull script from scratchpad into `longevity/pull_participation.py`; change `CACHE_DIR` to repo `cache/tba/`; add `pull_date` (passed in, since `Date.now` avoidance is irrelevant here — use `datetime.date.today().isoformat()`) to output.
- [ ] **Step 2:** Copy the existing 18 MB scratchpad cache into `cache/tba/` so no re-pull happens; run the script; confirm stderr shows `2020: ... 3904 teams` and `Wrote team_participation.json`.
- [ ] **Step 3:** Add `cache/`, `longevity/vendor/`, `longevity/team-longevity.html`, `longevity/team_participation.json` to `.gitignore`. Commit the script.

### Task 2: Compute module (the tested core)

**Files:**
- Create: `longevity/compute.js` (ES module)
- Test: `longevity/compute.test.mjs`
- Fixture: `longevity/records.json` (compact array, produced by build step; test reads it)

**Interfaces (exact exports):**
- `buildRecords(participation) -> {records: [{r,f,l,mask}], meta}` — `r`=rookie_year, `f`=first, `l`=last, `mask`=25-bit active bitmask (bit i = year 2002+i). `meta={start,end,pullDate}`.
- `activeByYear(records, start, end) -> {[year]: count}`
- `flows(records, start, end) -> {[year]: {rookies, returns, departures, deaths|null, net}}` (deaths null for provisional years > end−2)
- `cohortSurvival(records, start, end) -> {[cohort]: {N, surv: {[age]: fracOrNull}}}` (null where `cohort+age>end`)
- `departureByAgeYear(records, start, end) -> {[year]: {[band]: {dep, base, rate}}}`
- `standardizedRate(records, start, end, standardYears) -> {[year]: {crude, std, youngStd, vetStd}}`
- `ageComposition(records, start, end) -> {[year]: {[band]: frac}, medianAge: {[year]: n}}`
- `lifespanHistogram(records, end) -> {[len]: count}` (confirmed-dead only)

- [ ] **Step 1:** Write `compute.test.mjs` importing the functions above, loading `records.json`, asserting the golden values (active[2020]==3904; cohortSurvival pooled y2≈0.743±0.005; median lifespan==3; ageComposition 16+ 2026≈0.28±0.02; standardizedRate[2022].std≈0.217±0.01).
- [ ] **Step 2:** Run `node compute.test.mjs` → FAIL (module missing).
- [ ] **Step 3:** Implement `compute.js` (port the validated Python logic from the analysis scripts, 1:1).
- [ ] **Step 4:** `node compute.test.mjs` → PASS.
- [ ] **Step 5:** Commit `compute.js` + test.

### Task 3: Build script (records + inlining)

**Files:**
- Create: `longevity/build.py`
- Vendor: `longevity/vendor/d3.v7.min.js` (fetched once)
- Uses: `longevity/template.html` (Task 4)

**Interfaces:**
- `build.py` reads `team_participation.json`, writes `records.json` (compact, via the same bitmask scheme as `buildRecords`), and injects `<!--DATA-->`, `<!--D3-->`, `<!--COMPUTE-->` markers in `template.html` with the JSON, inlined D3, and inlined `compute.js` (module→inline `<script type="module">`), writing `team-longevity.html`.

- [ ] **Step 1:** Fetch D3 v7 minified into `longevity/vendor/d3.v7.min.js` (once; from jsdelivr). Verify file size ~280 KB.
- [ ] **Step 2:** Write `build.py`: produce `records.json`; string-replace the three markers in `template.html`; write `team-longevity.html`. Assert output contains no `<!--` markers and file opens.
- [ ] **Step 3:** Run `python3 build.py`; confirm `team-longevity.html` written and `records.json` present for the test.
- [ ] **Step 4:** Re-run `node compute.test.mjs` now that `records.json` exists → PASS. Commit `build.py`.

### Task 4: The tool — template.html with five D3 views

**Files:**
- Create: `longevity/template.html`

**Interfaces:** consumes inlined `compute.js` exports and the embedded `RECORDS`/`META` globals.

Layout: sticky header (title, data source + pull date, theme toggle); global controls bar (metric toggle Counts/Rate/Age-standardized where applicable, shared year-range brush, methodology disclosure panel); five view sections stacked. Provisional years (2025–26) hatched/dimmed; COVID (2020–21) shaded with annotation; theme-aware light/dark per the dataviz skill; wide charts scroll inside their own container.

- [ ] **Step 1:** Header + controls + methodology panel (definitions from Global Constraints) + light/dark theming + responsive CSS shell. Wire the shared year-range and metric state.
- [ ] **Step 2:** View 1 — Population & net flow (`activeByYear`+`flows`): area + net bars, 2020-peak + COVID annotations, hover tooltip.
- [ ] **Step 3:** View 2 — Acquisition vs Retention (`flows`): diverging stacked bars (rookies+returns up, departures down) + net line; Counts↔Rate toggle; era shading.
- [ ] **Step 4:** View 3 — Cohort survival (`cohortSurvival`): overlaid curves, cohort color ramp, COVID cohorts highlighted, lines stop at observable age, cohort selector, pooled reference; lifespan histogram (`lifespanHistogram`) companion.
- [ ] **Step 5:** View 4 — Age-adjustment reveal (`departureByAgeYear`+`standardizedRate`): age-band×year heatmap + crude-vs-standardized line chart (the Simpson reveal).
- [ ] **Step 6:** View 5 — Field aging (`ageComposition`): age-composition stacked area + median-age line.
- [ ] **Step 7:** `python3 build.py`; open `team-longevity.html` in a browser (Chrome MCP) and confirm all five views render, the year brush filters, and the metric toggle recomputes (spot-check crude vs std departure for 2024 against Python). Commit `template.html`.

### Task 5: Verification & docs

- [ ] **Step 1:** Full pipeline dry-run from clean: `python3 longevity/pull_participation.py` (cached, fast) → `python3 longevity/build.py` → `node longevity/compute.test.mjs` (PASS).
- [ ] **Step 2:** Browser verification of the built file (Chrome MCP): screenshot each view; confirm toggles + brush + theme switch work and provisional/COVID styling shows.
- [ ] **Step 3:** Add `longevity/README.md` documenting the pipeline, the durable `cache/tba/` location (shared across analyses), definitions, and how to rebuild. Commit.

## Self-Review

- **Spec coverage:** §4 pipeline → Tasks 1/3; §5 five views → Task 4; §3 definitions → Global Constraints + Task 4 methodology panel; §6 interactions → Task 4 Step 1; §7 visual → Task 4; §8 verification → Tasks 2 & 5. All covered.
- **Placeholders:** none; golden values and interfaces are concrete.
- **Type consistency:** `compute.js` export names in Task 2 match usages in Task 4 steps and `build.py` markers in Task 3.
- **Caching requirement:** Task 1 Steps 1–2 make the TBA cache durable at `cache/tba/` and preload it; documented in Task 5 Step 3.
