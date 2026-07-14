# FRC Competitiveness & Survival — Analysis Page Design

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation planning
**Relationship:** Second analysis in the `frc-analysis` repo, a companion to the team-longevity
tool ([2026-07-14-team-longevity-analysis-design.md](2026-07-14-team-longevity-analysis-design.md)).
A separate self-contained page, cross-linked with it, on the same GitHub Pages site.

## 1. Question

Does a team's **competitive success within its region** relate to how long it survives — and if
so, what does that imply about where a young team's fate is set, and whether struggling teams are
an identifiable at-risk group? Competitiveness is measured **relative to region**, never global
rank, because regions differ in strength (a mid-pack California team can be globally strong yet
locally ordinary, and it is the local standing that tracks survival).

## 2. Voice

**Neutral and straight.** This page presents the data solidly and lets the reader draw
conclusions; it is *supporting material*, not a persuasive brief. No advocacy language, no
"should," no calls to action. Where a finding bears on a policy question (e.g. directing resources
to struggling teams), state the evidence and its limits plainly and stop there. Match the
longevity tool's tone.

## 3. Findings (validated; drive the views and serve as test golden values)

- **Competitiveness predicts survival at every age.** P(team active 3 seasons later), by region
  EPA bucket: new teams (age 0–2) 62% / 69% / 80% (bottom-10 / below-median / above-median); by
  age 11+, 78% / 87% / 96%. Monotonic within every age band — not an age artifact.
- **Early standing forecasts the long run.** Mean region standing over a team's **first 4 seasons**
  (the standardized formative window) → reach year 5: **27% / 54% / 71%**; reach year 10:
  18% / 39% / 60%.
- **The relationship is a smooth gradient with a bottom-decile cliff.** Early-standing decile →
  reach year 5 climbs monotonically from **27% (bottom decile) to 79% (top decile)**, steep through
  the lower half and flattening above the median. New teams skew low (they are ranked against
  regional veterans), so upper buckets are sparse.

**Standardized windows:** the formative window is a team's **first four seasons** (years 1–4);
the trajectory/recovery view compares **year 1 vs years 2–4**; "established/veteran" begins at
**age 4+ (year 5 on)** — so the years-1–4 / year-5+ split is consistent across every view.
- **A rough rookie year is recoverable.** Among teams that started bottom-10% in year 1, survival
  to year 5 by where they got to in years 2–4: stayed bottom **44%**, climbed to below-median 57%,
  climbed to above-median **76%** — nearly matching teams that started strong. Survival tracks the
  years-2–4 standing far more than the year-1 standing.
- **For veterans (age 4+), a bottom-decile season is a risk marker that does not compound much
  with duration.** Survive +3 years: not-bottom **89.6%**; bottom 1 year 72.8%; 2 years 69.0%;
  3+ years 72.9%. A single down year already carries most of the signal. Recovery matters:
  veterans who climb back out the next year survive +2 more at **86.5%** vs **75.2%** for those who
  stay down.

Honest limits, stated on the page: this is correlation. EPA likely proxies program resources
(mentors, funding, student pipeline) as much as it drives survival; the data shows struggling
teams are at-risk and that competitive recovery tracks survival, but cannot show that *providing*
support would cause recovery. 2020 EPA is sparse and 2021 is absent (COVID); recent cohorts'
survival is provisional (a team absent <2 completed seasons is not yet confirmed folded).

## 4. Region model (the reference group for "in the area")

A stable 10-region partition, balanced by all-time team count, covering every team:

| Region | Teams | Region | Teams |
|---|---|---|---|
| Michigan | 936 | Midwest (MN, WI, IA, MO, KS, NE, ND, SD, OH, IN, IL, OK) | 1,221 |
| California | 611 | West (WA, OR, AZ, CO, NV, UT, NM, ID, MT, WY, HI, AK) | 815 |
| Texas | 482 | Canada | 612 |
| Northeast (NY, NJ, MA, CT, NH, ME, VT, RI) | 870 | International (all non-US, non-Canada) | 1,257 |
| Mid-Atlantic (PA, MD, DE, DC, WV, VA, NC) | 624 | | |
| Southeast (FL, GA, SC, TN, AL, MS, KY, AR, LA) | 917 | | |

State strings are normalized (TBA mixes `"Michigan"`/`"MI"`, `"Türkiye"`/`"Turkey"`); PR/Guam fold
into West. **Region-relative EPA percentile** = a team's rank by EPA among all teams active in its
region that year (region-years with <15 teams are skipped). **Buckets:** Bottom 10% (0–10) /
Below-median (10–50) / Above-median (50–100).

## 5. Views (path-first, then established-team risk)

1. **The gradient (headline).** Early (first-4-season) local-standing decile → % reaching year 5
   (toggle: year 10). A bar/lollipop chart — the smooth climb and the bottom-decile cliff, without
   arbitrary buckets.
2. **Survival curves by early standing (the spine).** Three fanned survival curves (Bottom-10 /
   Below-median / Above-median), age 0→16, y = % still active.
3. **It's not just age.** Survival-by-bucket within age bands (new / 3–5 / 6–10 / 11+), grouped
   bars, showing the effect holds at every age.
4. **Recovery — a rough rookie year isn't destiny.** Teams that started bottom-10% in year 1,
   survival curves split by their years-2–4 standing (stayed bottom / climbed below-median /
   climbed above-median), with a faint "started above-median" benchmark line.
5. **Established teams & slumps.** Veteran (age 4+) survival by bottom-decile streak length
   (not-bottom / 1 yr / 2 yrs / 3+ yrs) plus the climb-out-vs-stay-down recovery split. Presents
   the at-risk-population evidence relevant to the resource-targeting question, with the causal
   caveat adjacent. (This view also covers the "ongoing health of existing teams" angle.)

## 6. Interactions
- **Region filter** (All FRC + the 10 regions) drives every view; series recompute client-side
  from the filtered team set.
- **Bucket labels** exactly as in §4 — never "middle" for a 10th-percentile team.
- **Methodology panel** (persistent): §4 definitions, the §3 honest limits, data sources + pull
  date, the rookie-skew note, and the COVID EPA gap.
- COVID (2020–21) and provisional-recent-year treatment consistent with the longevity tool.

## 7. Architecture
```
competitiveness/
  pull_epa.py          # Statbotics /team_years by year -> epa.json (cache cache/statbotics/)
  compute.js           # tested: region percentile, buckets, survival curves, gradient,
                       #   recovery, veteran streaks
  compute.test.mjs     # golden values from §3
  template.html        # the page (hand-rolled D3, region filter, 5 views)
  build.py             # inline D3 + compute.js + embedded compact data -> competitiveness.html
  README.md
```
- **Data pull:** Statbotics mirror `/v3/team_years?year=Y` (paginated), cached durably under the
  shared `cache/statbotics/`. Joined with `../longevity/team_participation.json` for survival and
  location. Statbotics is not depended on at runtime.
- **Embedded records (compact):** per team — rookie, first, last, survival-years bitmask, region,
  and per-active-year region percentile. Bucketing / early / year-1 / years-2–4 / streak
  classifications are computed **client-side** so the region filter recomputes live.
- **Self-contained output** `competitiveness.html`, all client-side, hostable on the Pages site.
- **Cross-linking:** a small nav link in each page's header pointing at the other; the site root
  can offer both. Reuse the longevity tool's visual system (theme-aware light/dark, dataviz
  palette, tooltips, provisional hatching).

## 8. Testing & verification
- `compute.js` unit-tested (node) against §3 golden values: region sizes; decile gradient
  27%→79%; early buckets 27/54/71 (yr5) and 18/39/60 (yr10); age-controlled monotonicity;
  recovery 44% vs 76% (yr5); veteran streaks 89.6 / 72.8 / 69.0 / 72.9; climb-out 86.5 vs 75.2.
- Browser-verified like the longevity tool: each view renders, the region filter recomputes,
  spot-check one series against the Python analysis.

## 9. Out of scope
- Global-rank or absolute-EPA framings (deliberately excluded — the point is region-relative).
- Causal claims or any intervention modeling.
- Changing the longevity tool's own state/district area filter to this region scheme (the two
  analyses keep their own area models).
