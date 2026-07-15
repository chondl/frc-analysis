# FRC Analysis

Independent data-analysis projects for the FIRST Robotics Competition (FRC), built on
[The Blue Alliance](https://www.thebluealliance.com/) and [Statbotics](https://statbotics.io/) data.

This is a **standalone repository** — deliberately separate from any fork of the statbotics
codebase, so analysis work and planning docs never diff against that upstream.

## Live site

**[chondl.github.io/frc-analysis](https://chondl.github.io/frc-analysis/)** — GitHub Pages, served
from the repo root on `main`. [`index.html`](index.html) is the hub linking the analyses below;
each one is a single self-contained page (embedded data, all client-side) that also opens straight
from the filesystem, no server.

## Projects

Each directory is one analysis, laid out the same way: a `pull_*.py` data pull, a `build.py` that
derives and inlines everything into `template.html`, and a pure `compute.js` covered by
`compute.test.mjs`.

- **[`longevity/`](longevity/)** — team survival and the acquisition-vs-retention question,
  2002–2026: cohort survival, gains and losses, retention by team age, the aging of the field.
  See [`longevity/README.md`](longevity/README.md).
- **[`competitiveness/`](competitiveness/)** — whether a team's competitive standing *within its
  region* relates to how long it lasts. Region-relative EPA percentiles, ten balanced regions.
  See [`competitiveness/README.md`](competitiveness/README.md).
- **[`california/`](california/)** — the California teams that hit the bottom decile of California
  EPA in ≥1 season since 2023: a sortable watch list applying the competitiveness finding to a
  concrete set of teams. See [`california/README.md`](california/README.md).

## Shared response cache

Every upstream HTTP response is cached under **`cache/`**, keyed by URL SHA1 — `cache/tba/` for
The Blue Alliance, `cache/statbotics/` for Statbotics. The whole directory is gitignored: it is
large and fully re-derivable. A cached URL is never re-fetched, so re-runs are instant, and any
new analysis here should read/write the same directories rather than pulling its own copy.

The TBA key is read from `~/thebluealliance_api_key.txt`. Statbotics needs no key.

## Docs

Design specs live under [`docs/superpowers/specs/`](docs/superpowers/specs/), implementation plans
under [`docs/superpowers/plans/`](docs/superpowers/plans/). They are point-in-time records of what
was decided and why; where a spec and the code disagree, the code won.
