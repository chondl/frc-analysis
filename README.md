# FRC Analysis

Independent data-analysis projects for the FIRST Robotics Competition (FRC), built on
[The Blue Alliance](https://www.thebluealliance.com/) and [Statbotics](https://statbotics.io/) data.

This is a **standalone repository** — deliberately separate from any fork of the statbotics
codebase, so analysis work and planning docs never diff against that upstream.

## Projects

- **[`longevity/`](longevity/)** — team survival & the acquisition-vs-retention question, 2002–2026.
  A single self-contained interactive tool (`longevity/team-longevity.html`). See
  [`longevity/README.md`](longevity/README.md).

## Shared TBA cache

Every TBA API response is cached under **`cache/tba/`** (gitignored — large, and fully
re-derivable). Any analysis in this repo should read/write that same directory so a URL is
never fetched twice. TBA key is read from `~/thebluealliance_api_key.txt`.

## Docs

Design specs and implementation plans live under `docs/superpowers/`.
