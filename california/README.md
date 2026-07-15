# California Bottom-Decile Watch List

The California teams that finished in the **bottom 10% of California by EPA** in at least one season
since 2023 — the standing the [`../competitiveness/`](../competitiveness/) analysis ties to elevated
churn risk. A single self-contained page, **[`california.html`](california.html)**: sortable table,
embedded data, all client-side. Applies the parent's finding to a concrete list; it is a watch list,
not a new analysis.

Design spec: [`../docs/superpowers/specs/2026-07-14-california-watchlist-design.md`](../docs/superpowers/specs/2026-07-14-california-watchlist-design.md).

## Pipeline

```
pull_teams.py ───────────────────────► teams.json ─┐
                                                   ├─► build.py ──► data.json + california.html
../competitiveness/epa.json ───────────────────────┤              (compute.js + palette inlined)
../longevity/team_participation.json ──────────────┘
```

- **`pull_teams.py`** — TBA nickname + city per team, from the shared `../cache/tba/` (already warm
  from the longevity pull, so this normally makes no network calls).
- **`build.py`** — owns `CITY_COUNTY` and `SOCAL`, ranks CA teams by EPA per season, selects the
  list, writes compact `data.json`, inlines `compute.js` + palette into `template.html`.
- **`compute.js`** — pure, tested: cell states, overall percentile, filtering, sorting.
- **`palette.json`** — cell colors, single source of truth for both the CSS and the contrast test.

## Rebuild

```bash
python3 california/pull_teams.py   # cached; needs ~/thebluealliance_api_key.txt
python3 california/build.py        # writes data.json + california.html
node    california/compute.test.mjs
```

## Method (short)

**Membership:** bottom 10% by EPA *among California teams* in ≥1 of 2023–2026. Teams need not have
played all four seasons — rookies and teams that have since stopped both qualify on the years they
played. **Percentile** = rank among every CA team that competed that season (the parent's
region-relative measure, California region); **overall** = mean across only the seasons played.
Percentiles are **always statewide** — the Northern/Southern filter hides rows, never recomputes.

**Northern vs Southern** follows FIRST's *California District Details* (Rev. Feb 5, 2025), governing
the two 2026 district championships: SoCal is exactly ten counties — San Luis Obispo, Kern, San
Bernardino, Santa Barbara, Ventura, Los Angeles, Orange, Riverside, San Diego, Imperial — and NorCal
is the other 48. Purely geographic, so teams that skipped 2026 place with no guesswork.

**County** is derived from the team's TBA city via `CITY_COUNTY` in `build.py` — TBA publishes no
county, and every team here has null coordinates. That map decides the Northern/Southern column, so
an unmapped city is a **hard build error**, never a default. Add new cities there.

**Limits:** correlation, inherited from the parent. EPA likely reflects program resources as much as
it drives survival, and new teams skew low because they are ranked against veterans — many teams here
appear on the strength of a rookie season alone, which the parent shows is not destiny.

## Notes for future edits

- `data.json` stores percentiles as integer per-mille and **`build.py` floors rather than rounds** —
  `floor(p*1000) < 100` exactly when `p < 0.10`, so the encoding preserves bucket membership at the
  .10/.50 boundaries. Rounding snapped a qualifying `.0995` to `100` and put a team on the list with
  no bottom-decile year shown. A build assertion now catches that.
- The page is dark-only, so **contrast is asserted, not eyeballed**: `compute.test.mjs` composites
  each cell color over its tint and fails below WCAG AA 4.5:1.
