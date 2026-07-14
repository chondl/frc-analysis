#!/usr/bin/env python3
"""
pull_epa.py — EPA per team-year from the Statbotics mirror (bulk /team_years by year).

Writes epa.json (next to this script): team -> year -> {epa, state, country}. Region-relative
percentiles are computed later in build.py from raw EPA within each region-year.

Every HTTP response is cached durably under the shared cache/statbotics/ directory, so re-runs
and other analyses never re-pull. See ../README.md.
"""
from __future__ import annotations
import hashlib, json, os, sys, time, urllib.error, urllib.request

SB = "https://api-statbotics.iterativerefinement.com/v3"
START, END = 2002, 2026
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CACHE = os.path.join(REPO, "cache", "statbotics")


def http_json(url, retries=5):
    cp = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(cp):
        return json.load(open(cp))
    last = None
    for a in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "epa-pull/1.0"}), timeout=40) as r:
                d = json.load(r)
            os.makedirs(CACHE, exist_ok=True); json.dump(d, open(cp, "w")); return d
        except urllib.error.HTTPError as e:
            if e.code == 404: return []
            last = e
        except Exception as e:
            last = e
        time.sleep(0.6 * (2 ** a))
    raise RuntimeError(f"fail {url}: {last}")


def main():
    out = {}
    for year in range(START, END + 1):
        n = 0; offset = 0
        while True:
            batch = http_json(f"{SB}/team_years?year={year}&limit=1000&offset={offset}")
            if not batch: break
            for t in batch:
                epa = (t.get("epa") or {}).get("total_points")
                out.setdefault(str(t["team"]), {})[str(year)] = {
                    "epa": epa, "state": t.get("state"), "country": t.get("country"),
                }
            n += len(batch); offset += 1000
            if len(batch) < 1000: break
        print(f"  {year}: {n} team-years", file=sys.stderr)
    json.dump(out, open(os.path.join(HERE, "epa.json"), "w"))
    print(f"Wrote epa.json: {len(out)} teams", file=sys.stderr)


if __name__ == "__main__":
    main()
