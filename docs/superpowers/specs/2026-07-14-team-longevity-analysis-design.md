# FRC Team Health & Longevity — Analysis Tool (Phase 1) Design

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation planning
**Scope:** Phase 1 — national longevity & flows. Regional and EPA-competitiveness cuts are explicit future phases.

## 1. Problem & motivating question

Community lore holds that FRC teams used to last for many years and now "make it a
year or two and leave," and national FIRST messaging frames the challenge as a need to
*start* more teams. The underlying question:

> Does FRC have an **acquisition** problem (can't create teams) or a **retention**
> problem (creates teams that then leave)?

This tool lets an analyst explore team survival and the acquisition-vs-retention
decomposition for FRC as a whole, 2002–2026, and — critically — reproduce the findings
themselves. The naive aggregate view actively misleads (see §3), so the tool's job is as
much *honest framing* as it is exploration.

## 2. Findings from the first-cut analysis (context that justifies the views)

These are validated numbers from the exploratory pull; they anchor both the narrative and
the verification golden values.

- **Participation** peaked at **3,904 active teams in 2020**; 2026 (3,728) has **not**
  recovered to that peak.
- **Acquisition is the durable problem.** Rookies ran ~429/yr pre-COVID (2016–19) and
  ~292/yr post-COVID (2023–26), a **−32%** drop that has not recovered (rookies fell again
  to 256 in 2026). The US decline is broad and worst in strongholds — Michigan −36%,
  California −51%, Texas −39%, Minnesota −83%.
- **Retention did not durably worsen.** Confirmed-death rate fell (6.5% → 5.7%). The
  age-standardized departure rate spiked in 2022 (COVID unwind, ~21.7%) then decayed to a
  plateau only ~1–1.5 pts above the pre-COVID baseline by 2024–25. Early-life survival
  recovered: 2022–23 rookie cohorts reach year 3 at 78–80%, matching/beating pre-COVID.
- **The aggregate departure rate misleads (Simpson's paradox).** The crude rate looks flat
  at ~7.6% across eras, but age-*for*-age departure rose in every band; the aggregate only
  looks flat because the field aged dramatically (median team age **4 → 10** in a decade;
  age-16+ veterans went from 11% → 28% of the field, and veterans rarely leave). Any tool
  that shows only the flat crude line hides the real story.
- **Cohort survival is stable and steep, not worsening.** Pooled: 85% reach year 1, 74%
  year 2, 67% year 3, 56% year 5, 45% year 10. Median lifespan of a team that eventually
  folds is **3 seasons**; the single most common lifespan is **1 season**.
- **COVID is a scar, not a trend.** ~900 confirmed deaths across 2020–21; the 2021 at-home
  season was a cliff (net −828). Attrition then normalized.

## 3. Definitions (locked; encoded in code and surfaced in the UI)

| Concept | Definition |
|---|---|
| **Active in year Y** | Played ≥1 *official* event (TBA event types 0–5: regional, district, district-cmp, cmp-division, einstein). Offseason/preseason excluded. |
| **Lifespan** | `last_active_year − rookie_year`; interior gaps count as *alive* (gap-tolerant). |
| **Confirmed dead** | Last active season ≤ `END_YEAR − 2` (absent ≥2 completed seasons). |
| **Cohort** | TBA `rookie_year`, restricted to 2002–2026 (avoids pre-2002 left-truncation). |
| **Provisional years** | 2025 and 2026: losses/deaths cannot be confirmed yet. Rendered with hatching / reduced opacity in every view. |
| **Window** | 2002–2026 (2026 season complete). |

Data sources: **The Blue Alliance API v3** (participation, rookie year, location) — key at
`~/thebluealliance_api_key.txt`. Statbotics is *not* used in phase 1. The methodology panel
shows the source and pull date.

**Known caveats surfaced in-tool:** TBA event rosters count *registered* teams (2020 is
slightly inflated by events cancelled mid-season after registration); the gap-tolerant model
correctly counts teams that sat out and returned (e.g. 378 returned in 2022) as not-dead.

## 4. Architecture

Two build-time pieces produce one runtime artifact:

```
longevity/
  pull_participation.py   # TBA pull -> team_participation.json (on-disk cache)
  build.py                # team_participation.json (+ inlined D3) -> team-longevity.html
  template.html           # HTML/CSS/JS skeleton with injection points
  team-longevity.html     # OUTPUT: the single self-contained deliverable
```

- **`pull_participation.py`** (already written; promote from scratchpad). For every team,
  the set of official-participation years 2002–2026, plus TBA `rookie_year`, state, country.
  Reuses the retry+cache HTTP pattern from `build_offseason_table.py`.
- **`build.py`** emits a **compact per-team array** — `[rookie_year, first_year, last_year,
  years_bitmask]` over the 25-season window — and injects it, plus inlined minified D3, into
  `template.html`. The browser recomputes all rates and the age-standardization live, so the
  Counts/Rate/Age-standardized toggles are real, not precomputed. ~8,362 records embed to
  well under 1 MB.
- **Runtime:** a single self-contained `.html`, all client-side, no network calls, hostable
  anywhere (e.g. statbotics.iterativerefinement.com).

**Why client-side recompute:** the age-standardization toggle is the core insight; it must be
computed from per-team records against a selectable standard population, not baked into a
static series.

## 5. Views

Each view is a hand-rolled D3/SVG chart. All share COVID shading, provisional-year hatching,
and the global year-range brush.

1. **Population & net flow.** Active-teams-per-year area chart with a net-change bar overlay.
   Annotations: 2020 peak line, COVID discontinuity (2020 cut short, 2021 at-home), "still
   below peak" marker. Hover → year tooltip (active, net, rookies, departures).

2. **Acquisition vs Retention** *(headline debate-settler).* Diverging stacked bars per year:
   above axis = rookies + returns; below axis = departures; net line overlaid. Metric toggle
   Counts ↔ Rate. Pre/post-COVID eras shaded. Visually shows intake shrinking while departures
   hold roughly steady.

3. **Cohort survival.** Overlaid survival curves, one line per rookie cohort, x = age (0–24),
   y = % surviving (`last ≥ rookie + age`). Cohort color ramp (sequential); COVID cohorts
   (2019–21) highlighted. Each line stops at its observable age (right-censoring shown; no
   fabricated tails). Cohort selector to compare; a pooled reference curve. Companion:
   lifespan histogram of completed (confirmed-dead) lifespans.

4. **The age-adjustment reveal** *(analytical centerpiece).* Heatmap (age band × year) of
   departure rate, paired with a line chart of **crude vs age-standardized** departure rate
   over time — the Simpson's-paradox reveal. The standard population is the pre-COVID
   (2016–19) age composition; recomputed client-side.

5. **Field aging** *(support for view 4).* Age-composition stacked area (share of field by age
   band) plus median-age line (4 → 10). Explains why the aggregate rate misleads.

## 6. Interaction model

- **Metric toggle:** Counts / Rate / Age-standardized (applies where meaningful; recomputed
  client-side from per-team records).
- **Shared year-range brush** across views.
- **Cohort selector** for view 3.
- **Methodology panel:** the §3 definitions, caveats, data source, and pull date.
- **Provisional treatment:** 2025–26 hatched / reduced opacity everywhere, with a legend note.

## 7. Visual design

Apply the **dataviz** skill. Theme-aware light + dark (`prefers-color-scheme` plus a manual
toggle). Restrained categorical palette; a sequential ramp for cohort lines. Deliberate
annotation of the COVID discontinuity rather than smoothing over it. Responsive; wide charts
scroll horizontally inside their own container so the page body never scrolls sideways.

## 8. Verification

- **`build.py` unit tests** against validated golden values: 2020 active = 3,904; pooled
  year-2 survival = 74.3%; US rookies −37% (2016–19 vs 2023–26); median completed lifespan = 3;
  age-16+ field share 11% → 28%.
- **Browser check** of the built HTML: confirm each view renders, the year brush filters, and
  the Counts/Rate/Age-standardized toggle recomputes correctly by spot-checking crude vs
  standardized departure rate for one year against the Python output.

## 9. Future scope (deliberately excluded from phase 1)

- **Regional/state slicing** — the rookie-decline-by-region cut (Michigan −36%, Minnesota
  −83%, Türkiye +182%, Brazil +589%). Data model does **not** pre-build for this in phase 1.
- **EPA competitiveness / "health" cut** — using Statbotics EPA to test whether persistently
  non-competitive teams (e.g. persistent bottom-10% in their region) leave at higher rates,
  and what the first-five-years path to long-term health looks like. This is the most
  promising *internal* lever on *why* teams leave, but is a separate phase with its own large
  Statbotics pull. Not pre-built in phase 1.
```
