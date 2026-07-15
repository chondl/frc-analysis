# FRC Team Longevity — analysis tool

A single self-contained `team-longevity.html` exploring FRC team survival and the
acquisition-vs-retention question, **2002–2026, nationally**. All client-side, hand-rolled
D3, embedded data — open the file in any browser, no server.

Design spec: [`../docs/superpowers/specs/2026-07-14-team-longevity-analysis-design.md`](../docs/superpowers/specs/2026-07-14-team-longevity-analysis-design.md).
Plan: [`../docs/superpowers/plans/2026-07-14-team-longevity-analysis.md`](../docs/superpowers/plans/2026-07-14-team-longevity-analysis.md).

## Pipeline

```
pull_participation.py  ──►  team_participation.json  ──►  build.py  ──►  team-longevity.html
   (TBA API v3)                                            (+ D3, compute.js inlined)
```

1. **`pull_participation.py`** — for every team, the set of years (2002–2026) it played ≥1
   *official* event, plus TBA `rookie_year`, state, country. Writes `team_participation.json`.
2. **`compute.js`** — pure derivation of every series (survival, flows, age-standardized
   departure rate, composition …) from a compact per-team record array. Unit-tested by
   `compute.test.mjs`; the build inlines it verbatim, stripping its `export` keywords so the
   browser calls the exact functions the tests exercise.
3. **`build.py`** — inlines D3, `compute.js`, and `team_participation.json` into `template.html`,
   producing the one-file `team-longevity.html`.

## Rebuild

```bash
python3 longevity/pull_participation.py   # fast: everything is cached (see below)
node    longevity/compute.test.mjs        # golden-value tests — must print ALL PASS
python3 longevity/build.py                # writes longevity/team-longevity.html
open    longevity/team-longevity.html
```

## Durable, shared TBA cache — `cache/tba/`

**Every TBA HTTP response is cached under the repo's `cache/tba/` directory**, keyed by URL
SHA1. A cached URL is never re-fetched, so re-runs are instant and **other analyses in this repo
should point their TBA cache at the same directory** to avoid re-pulling. The cache is durable
(gitignored, not ephemeral `/tmp`). The TBA key is read from `~/thebluealliance_api_key.txt`.

## Definitions (locked)

- **Active in year Y** = played ≥1 official event (TBA event types 0–5; offseason/preseason excluded).
- **Lifespan** = first→last active year; interior gaps count as alive (gap-tolerant).
- **Confirmed dead** = absent ≥2 completed seasons ⇒ **2025–26 losses are provisional** (hatched in the UI).
- **Cohort** = TBA `rookie_year`, restricted to 2002–2026.

## Follow-on analyses

This first cut deliberately excluded regional slicing and the EPA competitiveness ("health") cut.
Both now live as separate analyses that read this tool's `team_participation.json` rather than
extending its data model:

- [`../competitiveness/`](../competitiveness/) — region-relative EPA standing vs survival.
- [`../california/`](../california/) — the California bottom-decile watch list.
