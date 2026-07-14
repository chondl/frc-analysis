# Competitiveness & Survival

Does a team's competitive success **within its region** relate to how long it survives? A single
self-contained page, **[`competitiveness.html`](competitiveness.html)** — hand-rolled D3, embedded
data, all client-side. Companion to [`../longevity/`](../longevity/); cross-linked, same Pages site.

Design spec: [`../docs/superpowers/specs/2026-07-14-competitiveness-survival-design.md`](../docs/superpowers/specs/2026-07-14-competitiveness-survival-design.md).

## Pipeline

```
pull_epa.py  ──►  epa.json  ─┐
                             ├─►  build.py  ──►  data.json  +  competitiveness.html
../longevity/team_participation.json ─┘        (region-relative EPA percentiles,
                                                 D3 + tested compute.js inlined)
```

- **`pull_epa.py`** — EPA per team-year from the Statbotics mirror (`/v3/team_years`), cached under
  the shared `../cache/statbotics/`.
- **`build.py`** — computes each team's **region-relative EPA percentile** (rank among its region's
  teams that season; 10 balanced regions), writes compact `data.json`, and inlines D3 + `compute.js`
  into `template.html`.
- **`compute.js`** — pure, tested derivations (`compute.test.mjs`, golden values from the analysis):
  the decile gradient, survival curves by early standing, age-controlled survival, the recovery
  split, and veteran bottom-decile streaks.

## Rebuild

```bash
python3 competitiveness/pull_epa.py    # cached; needs ~/thebluealliance… not required (Statbotics only)
python3 competitiveness/build.py       # writes data.json + competitiveness.html
node    competitiveness/compute.test.mjs
```

## Method (short)

Competitiveness = a team's EPA percentile among all teams active in its **region** that season
(region-years with <15 teams skipped) — never global rank. Buckets: Bottom 10% / Below median
(10–50%) / Above median (≥50%). Regions: Michigan, California, Texas each solo; Northeast,
Mid-Atlantic, Southeast, Midwest, West; Canada; International. **Correlation only** — EPA likely
proxies program resources as much as it drives survival; 2020 EPA is sparse and 2021 absent (COVID).
