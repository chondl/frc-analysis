# California Bottom-Decile Watch List — Design

A California-specific companion to
[Competitiveness & Survival](2026-07-14-competitiveness-survival-design.md). That page
established the retention finding: bottom-decile local standing marks teams at elevated risk of
churn, and climbing back out restores most of the odds. This page applies that finding to a
concrete, actionable list — the California teams that tripped the signal recently.

It is a **watch list, not a new analysis**. It is read *after* the competitiveness page, so it
re-teaches nothing; prose is two sentences.

## Membership rule

A team appears if it is a California team that fell in the **bottom decile of California EPA in at
least one of 2023, 2024, 2025, 2026**.

Percentiles are the same region-relative percentiles the competitiveness page uses, for the
California region: a team's rank by EPA among all California teams that played that season,
`i / (n - 1)` over the EPA-ascending order. Bottom decile is `< 0.10`. Teams need not have played
all four years — rookies and churned teams both qualify on the years they did play.

Verified counts against real data (2026-07-14 pull):

| | |
|---|---|
| Teams on the list | 81 |
| Still active (played 2026) | 67 |
| SoCal / NorCal | 51 / 30 |
| Counties represented | 16 |
| Teams with 1 / 2 / 3 / 4 bottom-decile years | 57 / 16 / 7 / 1 |

## NorCal / SoCal

From FIRST's *California District Details* (Rev. Feb 5, 2025), which governs the two 2026 district
championships (`2026cancmp` Northern, Daly City; `2026cascmp` Southern, Anaheim):

> "The northern border of San Luis Obispo, Kern, and San Bernardino counties is the dividing line
> between Northern California and Southern California. Teams from those three counties, plus Santa
> Barbara, Ventura, Los Angeles, Orange, Riverside, San Diego, and Imperial counties are considered
> Southern California teams. Teams in the state's other 48 counties are considered Northern
> California teams."

So **SoCal is exactly ten counties** — San Luis Obispo, Kern, San Bernardino, Santa Barbara,
Ventura, Los Angeles, Orange, Riverside, San Diego, Imperial — and NorCal is the other 48. The rule
is purely geographic, so it resolves teams that skipped 2026 with no guessing. Championship
*attendance* cannot be used: only the top 60 per half qualify, and by construction no bottom-decile
team is among them.

## Deriving county

TBA gives `nickname`, `city`, `postal_code` for all 81 teams, but **no county and no lat/lng**
(every one of the 81 has null coordinates). County is therefore derived from city via a committed
`CITY_COUNTY` map. The 81 teams span **58 distinct cities**, all unambiguous, mapping to 16
counties.

The map is the sole determinant of the NorCal/SoCal column, so `build.py` **hard-fails on an
unmapped city** rather than defaulting. A silent default would misassign a team's half.

## Table

Sortable by every column; default **team number ascending**.

| # | Column | Source |
|---|--------|--------|
| 1 | Team number | key |
| 2 | Team name | TBA `nickname` |
| 3 | County | `CITY_COUNTY[city]` |
| 4 | City | TBA `city` |
| 5 | NorCal / SoCal | county ∈ SOCAL |
| 6 | Overall percentile | `meanPct` over played years |
| 7–10 | 2023 / 2024 / 2025 / 2026 | per-year CA percentile |

**Overall percentile** is the mean of the team's CA percentiles across only the years it played —
identical to `meanPct()` in the competitiveness page's `compute.js`, for consistency with the parent.

**Percentiles are always statewide California**, regardless of the area filter. The filter hides
rows; it never recomputes numbers. Membership is defined statewide, so a half-relative percentile
could show a team on the list with no bottom-decile year visible in any column — which reads as a
bug.

## Cell states and color

Verified across the 81×4 = 324 cells: **268 played, 25 not-yet, 26 gone, 5 gap, and zero
played-but-no-EPA**. Every cell resolves to exactly one of five states.

| State | Meaning | Treatment |
|-------|---------|-----------|
| Bottom 10% (`< .10`) | | red `#e34948` family |
| Below median (`.10–.50`) | | amber `#eda100` family |
| Above median (`≥ .50`) | | blue `#2a78d6` family |
| Gone (`year > last season`) | already churned | violet `#8b6fd6` family, label `gone` |
| Not yet (`year < first season`) | didn't exist | neutral gray, label `—` |
| Gap (dormant, returned later) | sat out, came back | neutral gray, label `out` |

The three performance buckets reuse the parent page's exact vocabulary, so the red cells trace each
team's streak across the year columns. **Gone gets its own hue** because on a churn page it is the
outcome the page is about — a violet tail means a team already lost, and that must not look like an
empty cell. Violet sits between the existing red and blue and collides with neither.

Gap is only 5 cells across 4 teams (e.g. 6553 played 2017–21, went dormant, returned 2025). It
shares gray with not-yet and is distinguished by its label, rather than spending a sixth hue.

**Contrast is a hard requirement** — the page is dark-only. Every cell's text must clear **WCAG AA
4.5:1** against its own composited tinted background, asserted by an automated check in the test
suite, not by eye.

## Filters

- **Area** — All California / Northern California / Southern California.
- **Played 2026** — toggle, **default off** so all 81 show, including the teams already lost.

## Structure

Follows the repo's established per-analysis layout.

```
pull_teams.py ──► ca_teams.json ─┐
                                 ├─► build.py ──► data.json + california.html
competitiveness/epa.json ────────┤              (compute.js + data inlined)
longevity/team_participation.json ┘
```

- **`pull_teams.py`** — TBA `nickname` + `city` per team. Reads the shared `cache/tba/` (already
  warm; no network needed).
- **`build.py`** — owns `CITY_COUNTY` and `SOCAL`, computes CA percentiles, selects the 81, emits
  compact `data.json`, inlines `compute.js` + data into `template.html`.
- **`compute.js`** — pure, tested: `cellState`, `overallPct`, `bucketOf`, filter and sort. No DOM.
- **`compute.test.mjs`** — golden values from this document, plus the contrast assertion.

No D3 — this page is a table, not a chart.

## Links

- `index.html` — third card on the site hub.
- `competitiveness/template.html` — small header link, per the request.
- The new page links back to the competitiveness page, matching its header pattern.

## Honest limits

Inherited from the parent, and restated in the page's method note: this is **correlation**. EPA
likely reflects program resources as much as it drives survival, and new teams skew low because
they are ranked against veterans — several teams here are on the list solely for a rookie season,
which the parent page shows is not destiny. The list marks teams worth a look; it does not diagnose.
